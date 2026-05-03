# 파일 편집기 성능 병목 분석

## 분석 범위

- `src/pages/PageView.tsx` — 편집기 뷰 진입점, Zustand 구독, 메타데이터 핸들러
- `src/components/PageEditor.tsx` — 레거시 textarea 편집기 (WYSIWYG 비활성 시 사용)
- `src/components/TiptapEditor.tsx` — WYSIWYG Tiptap 편집기 컴포넌트
- `src/hooks/usePageSync.ts` — 자동저장(autosave) 및 페이지 로드 훅
- `src/hooks/useHighlightHoverTooltip.ts` — 하이라이트 hover 이벤트 관리
- `src/store/useStore.ts` — Zustand 전역 상태 정의

분석 방법: **코드 정적 분석** (런타임 프로파일러 없이 React 패턴, 의존성 배열, 스토어 구독 범위 점검)

---

## 병목 #1: PageView의 과도하게 넓은 Zustand 스토어 구독

- **위치**: `src/pages/PageView.tsx` line 24-28

```typescript
const {
  pagesArray, removePage, updatePageInStore, columnColors, showToast,
  highlightColors, config, isImmerseMode, setIsImmerseMode,
  pageWidth, setPageWidth, slashCommands,
} = useStore();
```

- **패턴**: `useStore()` 를 선택자(selector) 없이 호출해 스토어 전체를 구독. Zustand 는 기본적으로 `Object.is` 비교를 사용하므로 구독한 객체의 **어느 한 필드라도 변경되면** PageView 전체가 리렌더됨.
  - `pagesArray` 는 `setPages` / `addPage` / `updatePageInStore` / `removePage` 호출 때마다 새 배열 참조로 교체됨(line 188-265 in useStore.ts). 다른 페이지 하나의 컬럼이 바뀌어도 PageView 가 리렌더됨.
  - `config`, `columnColors`, `slashCommands` 도 Settings 화면에서 변경될 때 동일 문제 발생.

- **영향**: 모든 페이지 메타데이터 변경(다른 탭에서 컬럼 변경, 태그 추가 등) 시 PageView 가 완전히 리렌더됨. 메모 패널 / Tiptap 에디터 / TocPanel 등 모든 자식 컴포넌트의 불필요한 재렌더 유발.

- **해결 방향**:
  1. 각 필드별 세밀한 selector 사용:
     ```typescript
     // 현재
     const { pagesArray, columnColors, ... } = useStore();
     
     // 개선
     const columnColors = useStore(s => s.columnColors);
     const isImmerseMode = useStore(s => s.isImmerseMode);
     const highlightColors = useStore(s => s.highlightColors);
     ```
  2. `pagesArray` 대신 이미 구현된 `usePageById` / `usePagesByColumn` 훅 활용. PageView 는 사실 `pages` 배열 전체를 쓰는 게 아니라 컬럼/태그 드롭다운 목록(existingColumns, allTags)에만 사용하므로 `selectAllColumns` / `selectAllTags` selector 로 교체 가능.

---

## 병목 #2: PageEditor의 useEffect에 누락된 의존성 — 매 렌더마다 editorRef 재등록

- **위치**: `src/components/PageEditor.tsx` line 374-387

```typescript
// Expose methods to parent via editorRef
useEffect(() => {
  if (editorRef) {
    editorRef.current = {
      save: () => handleSave(),
      togglePreview: () => handlePreview(),
      openImagePicker,
      preview,
      saving,
    };
  }
  return () => {
    if (editorRef) editorRef.current = null;
  };
}); // ← 의존성 배열 없음!
```

- **패턴**: `useEffect` 의 dependency array 가 완전히 생략되어 있어 **컴포넌트가 렌더될 때마다** 실행됨. 이는 인라인 객체 `{ save: () => handleSave(), ... }` 를 매 렌더마다 새로 생성하고 ref 에 다시 할당함. React DevTools 의 Profiler 에서 불필요한 커밋(commit)이 발생하는 주요 원인 중 하나임.

- **영향**:
  - `preview` / `saving` 상태 변경 뿐 아니라 `title`, `content`, `tags`, `dueDate`, `selectedColumn` 등 어떤 로컬 상태가 변경되어도 editorRef 재등록 수행.
  - PageEditor 를 embed 하는 부모 컴포넌트(PageView)도 이 effect 의 cleanup → re-setup 비용을 부담.

- **해결 방향**:
  ```typescript
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        save: handleSaveRef.current,  // stable ref
        togglePreview: handlePreviewRef.current,
        openImagePicker,
        preview,
        saving,
      };
    }
    return () => { if (editorRef) editorRef.current = null; };
  }, [preview, saving, openImagePicker]); // 실제 변화가 필요한 값만
  ```
  `handleSave` / `handlePreview` 는 ref 패턴으로 안정화 후 참조.

---

## 병목 #3: usePageSync — pagesArray 전체를 dependency로 받아 불필요한 재실행

- **위치**: `src/hooks/usePageSync.ts` line 193-197

```typescript
// Retry when pages become available (only if page hasn't loaded yet)
useEffect(() => {
  if (pageId && !page && !loading && pages.length > 0) {
    loadPage(pageId);
  }
}, [pages.length, pageId, page, loading, loadPage]);
```

그리고 line 41:
```typescript
useEffect(() => { pagesRef.current = pages; }, [pages]);
```

- **패턴**:
  - `usePageSync` 는 `pages: Page[]` 를 prop 으로 받는데, PageView 는 `pagesArray` (매 상태 변경마다 새 배열 참조) 를 그대로 전달함 (PageView line 85: `pageId, pages`).
  - `useEffect` 의 dependency `[pages]` 는 `pagesArray` 참조가 바뀔 때마다 실행됨. 페이지가 100개인 경우 다른 페이지 메타 변경 1회마다 `pagesRef.current = pages` effect 가 실행됨.
  - `usePageSync` 의 `loadPage` 는 내부적으로 `currentPages.find(p => p.id === id)` (O(n)) 로 페이지를 찾음 (line 143). 정규화된 인덱스를 활용하지 않음.

- **영향**: 페이지가 많을수록 다른 페이지 편집/추가 시 매번 effect 가 실행되어 불필요한 CPU 사이클 소모. 특히 메모, 태그, 컬럼을 자주 변경하는 유저에게 축적 영향이 큼.

- **해결 방향**:
  1. `usePageSync` 에 `pages: Page[]` 전체 대신 `pages` 맵(`Record<string, Page>`)과 `pageIds` 를 전달하거나, 내부에서 `useStore(s => s.pages[pageId])` 로 직접 구독.
  2. `loadPage` 내부의 `currentPages.find(p => p.id === id)` 를 `pagesRef.current[id]` (O(1) 맵 접근)로 교체.
  3. `pagesArray` 전달을 `pagesRef` 로 대체해 effect 의존성에서 제거:
     ```typescript
     // usePageSync 내부에서 pages prop 의존성 제거
     const pagesRef = useRef<Record<string, Page>>({});
     useEffect(() => { pagesRef.current = pages; });  // dependency 없이 ref 동기화
     ```

---

## 병목 #4: PageEditor의 keyboard shortcut useEffect — 로컬 상태 전체 capture

- **위치**: `src/components/PageEditor.tsx` line 609-622

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();  // 클로저로 title, content, tags, dueDate, selectedColumn 캡처
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowFindBar(prev => !prev);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [title, content, tags, dueDate, selectedColumn]); // 5개 로컬 상태 모두 의존
```

- **패턴**: `handleSave` 함수가 `title`, `content`, `tags`, `dueDate`, `selectedColumn` 5개 로컬 상태를 클로저로 캡처하므로, dependency array 에 이들을 모두 포함. 사용자가 한 글자 타이핑할 때마다 `content` 가 바뀌어 `removeEventListener` → `addEventListener` 사이클이 발생함 (document-level 이벤트 리스너 재등록).

- **영향**: WYSIWYG 가 아닌 legacy textarea 편집기를 사용하는 경우, 타이핑 중 매 문자 입력마다 전역 keydown 리스너가 교체됨. 키 입력 빈도가 높은 상황에서 불필요한 이벤트 리스너 attach/detach 비용.

- **해결 방향**:
  ```typescript
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();  // ref 로 최신 버전 호출
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindBar(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // 비어있는 dependency — mount/unmount 1회만 등록
  ```

---

## 병목 #5: useHighlightHoverTooltip — MutationObserver 과 이벤트 핸들러 재등록 비용

- **위치**: `src/hooks/useHighlightHoverTooltip.ts` line 26-95

```typescript
const observer = new MutationObserver(() => {
  // 매 DOM 변경마다 모든 <mark> 요소의 이벤트 핸들러를 전부 detach → 재attach
  if (marks && handlers.length > 0) {
    marks.forEach((mark, i) => {
      if (handlers[i]) {
        mark.removeEventListener('mouseenter', handlers[i].enter);
        mark.removeEventListener('mouseleave', handlers[i].leave);
      }
    });
  }
  attachHandlers();  // querySelectorAll → forEach → addEventListener 반복
});
observer.observe(container, { childList: true, subtree: true });
```

- **패턴**: Tiptap 편집기에서 키 입력은 ProseMirror 의 Transaction 을 발생시키고, 이는 DOM mutation 을 유발한다. 즉 **사용자가 타이핑할 때마다** MutationObserver 콜백이 실행되어 모든 `<mark>` 요소의 핸들러를 일괄 재등록함. 하이라이트가 10개면 10 × 2 = 20회의 addEventListener 가 매 키 입력 후 발생.

- **영향**: 하이라이트 수가 많을수록 타이핑 중 레이턴시 증가. 특히 하이라이트가 20개 이상인 페이지에서 체감 가능. MutationObserver 는 `{ childList: true, subtree: true }` 로 전체 에디터 서브트리를 감시해 관계없는 DOM 변경에도 반응.

- **해결 방향**:
  1. **이벤트 위임(event delegation)** 으로 교체: 개별 mark 마다 핸들러를 붙이는 대신, 컨테이너 레벨에서 `mouseover`/`mouseout` 이벤트를 받아 `e.target.closest('mark.highlight-mark')` 로 처리. 핸들러는 1개, 재등록 불필요.
  2. MutationObserver `subtree: true` 범위를 `.ProseMirror` 등 실제 content root 로 한정.
  3. debounce 추가: `observer.callback` 을 `requestAnimationFrame` 으로 감싸 타이핑 burst 중에는 핸들러 재등록을 건너뜀.

---

## 병목 #6: TiptapEditor — useEditor extensions 배열이 매 렌더마다 새 참조

- **위치**: `src/components/TiptapEditor.tsx` line 133-234

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({ ... }),
    ResolvableImage.configure({
      saveImage: async (file: File) => saveImage(pagePath, file),  // 클로저
    }),
    WikiLinkSuggestion.configure({
      suggestion: {
        items: ({ query }) =>
          pages.filter(...).slice(0, 10).map(...),  // pages 클로저
      },
    }),
  ],
  ...
});
```

- **패턴**: `useEditor` 의 `extensions` 배열 안에 `pagePath`, `pages`, `onNavigate`, `onHighlightClick`, `onHighlight` 등 prop 값을 **직접 클로저로 캡처**하고 있음. `tiptap` 의 `useEditor` 는 내부적으로 extensions 를 mount 시 1회만 처리하지만, `WikiLinkSuggestion` 의 `items` 함수는 `pages` 배열을 직접 참조하므로 pages 가 업데이트될 때 suggestion 목록이 stale 해짐. 이를 방지하기 위해 `content` prop 변경 시 `editor.commands.setContent()` 를 별도 effect(line 249-262)로 처리하지만, 근본적으로 `pages` 클로저가 stale 한 경우 Wiki 링크 자동완성이 오래된 데이터를 보여줄 수 있음.

- **영향**: 페이지 네비게이션(다른 파일 열기) 시 TiptapEditor 가 unmount/remount 되어 editors.destroy() 비용 발생. 특히 대용량 문서에서 에디터 초기화 시간이 체감됨. `pagePath` 가 바뀔 때마다 `ResolvableImage` 의 `saveImage` 클로저가 stale 해 새 이미지 저장 경로가 이전 페이지를 가리킬 수 있는 잠재적 버그도 존재.

- **해결 방향**:
  1. 클로저 대신 **안정적인 ref** 를 통해 최신 값 참조:
     ```typescript
     const pagePathRef = useRef(pagePath);
     useEffect(() => { pagePathRef.current = pagePath; }, [pagePath]);
     
     ResolvableImage.configure({
       saveImage: async (file) => saveImage(pagePathRef.current, file),
     });
     ```
  2. `WikiLinkSuggestion` 의 `items` 함수 역시 `pagesRef.current` 를 참조하도록 변경.
  3. TiptapEditor 에 `key={page.id}` 를 부여해 페이지 전환 시 명시적 remount 유도(editor.destroy 타이밍 문제 해결).

---

## 우선순위 요약

| 병목 | 영향도 | 구현 난이도 | 우선순위 |
|------|--------|------------|---------|
| #1 PageView 과도한 스토어 구독 | 높음 — 임의 페이지 변경 시 PageView 전체 리렌더 | 낮음 — selector 함수 교체만 | **P1** |
| #3 usePageSync pagesArray 의존 | 중간 — 매 상태 변경마다 effect 재실행 | 중간 — 인터페이스 변경 필요 | **P1** |
| #4 PageEditor keyboard shortcut | 중간 — 타이핑 중 리스너 재등록 | 낮음 — ref 패턴 적용 | **P2** |
| #2 PageEditor editorRef useEffect | 낮음-중간 — 모든 렌더마다 effect 실행 | 낮음 — dependency 배열 추가 | **P2** |
| #5 useHighlightHoverTooltip | 중간-높음 — 하이라이트 많을 때 타이핑 지연 | 중간 — 이벤트 위임 리팩터링 | **P2** |
| #6 TiptapEditor extensions 클로저 | 중간 — stale 클로저 + 에디터 초기화 비용 | 높음 — Tiptap 내부 이해 필요 | **P3** |

---

## 다음 단계

Plans.md 에 추가를 권장하는 task:

1. **T2: PageView Zustand 구독 세밀화** (P1)
   - DoD: `useStore()` 전체 구독을 field-level selector 로 분리, `pagesArray` 를 `selectAllColumns` / `selectAllTags` 로 교체, `npm test` 통과

2. **T3: usePageSync 인터페이스 개선 — pages 맵 기반으로 전환** (P1)
   - DoD: `usePageSync` 가 `pages: Page[]` 대신 normalized pages map 을 사용, `loadPage` 내부 `find` 를 O(1) 맵 접근으로 교체, `npm test` 통과

3. **T4: PageEditor keyboard shortcut & editorRef effect 최적화** (P2)
   - DoD: keyboard shortcut useEffect 의존성 배열을 `[]` 로 축소(ref 패턴), editorRef useEffect dependency array 추가, `npm test` 통과

4. **T5: useHighlightHoverTooltip 이벤트 위임으로 교체** (P2)
   - DoD: MutationObserver 콜백에서 이벤트 핸들러 일괄 재등록 제거 → 컨테이너 이벤트 위임으로 대체, 하이라이트 20개 이상 페이지에서 타이핑 lag 없음 확인, `npm test` 통과
