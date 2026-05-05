---
name: code-review
description: |
  Pale Blue Dot 프로젝트 전용 코드 리뷰 스킬.
  React 18 + TypeScript + Vite + Tauri v2 + Zustand + Tiptap 스택에 특화된 리뷰를 수행한다.
  Service layer 분리, Normalized state, MCP type sync, 성능 패턴, 보안 취약점을 체계적으로 검토한다.
  reader-mobile/ 변경 시 reader-mobile-runtime 룰을 추가 적용한다.
  Use when: PR 리뷰, 특정 파일 리뷰, 변경 사항 품질 점검, 아키텍처 검토, 리팩토링 검증.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
argument-hint: "[파일경로 | PR번호 | --focus service|state|perf|security|types|mobile]"
---

# Pale Blue Dot Code Review

이 스킬은 [awesome-skills/code-review-skill](https://github.com/awesome-skills/code-review-skill) 의 리뷰 방법론을 이 프로젝트의 아키텍처 규칙에 맞게 특화한 것이다.

## 사용 예

| 명령 | 동작 |
|------|------|
| `/code-review` | 현재 브랜치 전체 변경사항 리뷰 (git diff main) |
| `/code-review src/components/PageEditor.tsx` | 특정 파일 리뷰 |
| `/code-review --focus service` | 서비스 레이어 패턴 집중 검토 |
| `/code-review --focus state` | Zustand 스토어 / 셀렉터 패턴 집중 검토 |
| `/code-review --focus perf` | 성능 패턴 집중 검토 |
| `/code-review --focus security` | 보안 취약점 집중 검토 |
| `/code-review --focus types` | TypeScript 타입 안전성 + MCP type sync 검토 |
| `/code-review --focus mobile` | reader-mobile 런타임 정합성 집중 검토 |
| `/code-review reader-mobile/` | reader-mobile 전체 디렉토리 리뷰 |

---

## reader-mobile 변경 감지 및 추가 체크리스트

diff 또는 인자에 `reader-mobile/` 경로가 포함되면 **[`.claude/rules/reader-mobile-runtime.md`](../../rules/reader-mobile-runtime.md) 의 전체 체크리스트를 추가 적용**한다.

### --focus mobile 또는 reader-mobile/ 경로 지정 시 절차

```bash
# 1. 직접 fetch 호출 감지 (critical)
grep -n "await fetch(" reader-mobile/services/githubService.ts

# 2. isMountedRef 가드 누락 감지 (critical)
grep -rn "setSyncing\|setColumns\|setLoading\|Alert\.alert" reader-mobile/app/ | \
  grep -v "isMountedRef"

# 3. SecureStore 키 불일치 (critical)
grep -n "GITHUB_TOKEN_KEY" \
  reader-mobile/services/secureConfigService.ts \
  reader-mobile/services/tokenService.ts

# 4. validateRepoUrl boolean 반환 처리 (major)
grep -rn "validateRepoUrl" reader-mobile/ | grep "=== true\|=== false\|if (await"

# 5. useEffect 단독 데이터 로드 (포커스 복귀 미처리)
grep -rn "useEffect" reader-mobile/app/ | grep "loadCachedData\|loadPages\|loadInitialValues"
```

mobile 특화 심각도:
- **`[critical]`**: 직접 `fetch()`, isMountedRef 누락 async setState, SecureStore 키 불일치
- **`[major]`**: `useEffect` 단독 포커스 재로드, 로딩/에러/빈 상태 누락, 동기화 중 뒤로가기 무방비
- **`[minor]`**: 스크롤 복원 누락, syncProgress 미표시

---

## 리뷰 절차

### Phase 1: 컨텍스트 파악

```bash
# 변경 범위 파악
git diff main --stat
git log main..HEAD --oneline

# 서비스 레이어 변경 감지
git diff main --name-only | grep "src/services/"

# MCP 타입 변경 감지
git diff main --name-only | grep "src/types/page.ts"

# 스토어 변경 감지
git diff main --name-only | grep "src/store/"
```

확인 사항:
- 변경 파일 수와 라인 수 (400줄 초과 시 분할 권고)
- 어떤 레이어(component/service/store/types)에 영향을 주는가
- `src/types/page.ts` 변경 여부 → MCP type sync 필요성 판단

### Phase 2: 프로젝트 규칙 검증

아래 **4개 핵심 규칙**을 우선 검토한다. 이 규칙들은 위반 시 `critical` 또는 `major` 로 분류된다.

### Phase 3: React/TypeScript 품질 검토

일반적인 코드 품질, 성능, 타입 안전성을 검토한다.

### Phase 4: 보안 검토

XSS, 민감 데이터 노출, command injection 리스크를 검토한다.

### Phase 5: 리뷰 결과 출력

```
**Verdict**: APPROVE | REQUEST_CHANGES | COMMENT

**Findings**:
  - [critical] ...
  - [major] ...
  - [minor] ...
  - [nit] ...
  - [praise] ...

**Next action**: ...
```

---

## 4개 핵심 규칙 (프로젝트 특화)

### Rule 1: Service Layer 분리

파일 시스템 / 이미지 / 페이지 CRUD 는 반드시 service 를 통해서만 접근한다.

```typescript
// ❌ [critical] 컴포넌트에서 직접 FS API 호출
import { invoke } from '@tauri-apps/api/core';
const content = await invoke('read_file', { path });

// ❌ [critical] window.showOpenFilePicker 직접 호출
const [handle] = await window.showOpenFilePicker();

// ✅ fileSystemService 를 통해 접근
import { fileSystemService } from '@/services/fileSystemService';
const content = await fileSystemService.readFile(path);
```

```typescript
// ❌ [major] updatePage 로 메타데이터만 변경 (write amplification)
await pageService.updatePage({ ...page, kanbanColumn: 'Done' });

// ✅ updatePageMetadata 사용 (96-98% 빠름)
await pageService.updatePageMetadata(page.filePath, { kanbanColumn: 'Done' });
```

감지 명령:
```bash
grep -r "showOpenFilePicker\|showSaveFilePicker\|showDirectoryPicker" src/components/
grep -r "invoke\(" src/components/ | grep -v "// "
grep -r "updatePage(" src/ | grep -v "updatePageMetadata\|pageService\|test"
```

### Rule 2: Normalized State (O(1) 조회)

`pages.find()` / `pages.filter()` 직접 호출 금지. 인덱스 기반 셀렉터 / hook 을 사용한다.

```typescript
// ❌ [major] O(n) 직접 검색
const page = pages.find(p => p.id === id);
const columnPages = pages.filter(p => p.kanbanColumn === col);
const children = pages.filter(p => p.parentId === parentId);

// ✅ O(1) 셀렉터 / hook
const page = usePageById(id);
const columnPages = usePagesByColumn(col);
const children = useChildPages(parentId);
```

```typescript
// ❌ [critical] store pages 를 직접 mutate
store.pages.push(newPage);        // 인덱스 desync!
store.pages[0].title = 'New';    // 인덱스 desync!

// ✅ store 메소드 사용
store.addPage(newPage);           // columnIndex, parentIndex 자동 갱신
store.updatePageMetadata(id, { title: 'New' });
```

감지 명령:
```bash
grep -rn "pages\.find\|pages\.filter" src/components/ src/hooks/
grep -rn "pagesArray\.find\|pagesArray\.filter" src/
```

### Rule 3: MCP Type Sync

`src/types/page.ts` 의 `Highlight` / `Memo` 타입 변경 시 반드시 같은 커밋에 MCP 서버를 rebuild 한다.

```bash
# 타입 변경 감지
git diff main -- src/types/page.ts

# MCP 서버 rebuild 필요 여부 확인
# Highlight / Memo 타입이 변경되었다면:
cd mcp-pale-blue-dot-server && npm run build
# dist/ 파일도 함께 커밋

# rebuild 됐는지 확인 (mtime 비교)
stat -f "%m %N" src/types/page.ts mcp-pale-blue-dot-server/dist/index.js
```

위반 기준:
- `Highlight` / `Memo` 타입 변경 있음 + `dist/` mtime 이 `page.ts` 보다 오래됨 → `critical`

### Rule 4: CSS 변수 사용

하드코딩된 색상값 대신 `global.css` 의 CSS 변수를 사용한다.

```css
/* ❌ [major] 하드코딩 색상 */
color: #333333;
background: #ffffff;
border: 1px solid #e0e0e0;

/* ✅ CSS 변수 */
color: var(--text-primary);
background: var(--bg-primary);
border: 1px solid var(--border-color);
```

감지 명령:
```bash
# 컴포넌트 CSS 파일에서 하드코딩 색상 찾기
grep -rn "#[0-9a-fA-F]\{3,6\}\|rgb(\|rgba(" src/components/ --include="*.css"
```

---

## React 18 + TypeScript 체크리스트

### Hooks 규칙

```typescript
// ❌ [blocking] 조건부 Hook 호출
if (isLoggedIn) {
  const [user, setUser] = useState(null); // Rules of Hooks 위반
}

// ❌ [major] useEffect 의존 배열 누락/불완전
useEffect(() => {
  fetchPage(pageId).then(setPage);
}, []); // pageId 누락!

// ✅ 완전한 의존 배열 + cleanup
useEffect(() => {
  let cancelled = false;
  fetchPage(pageId).then(data => {
    if (!cancelled) setPage(data);
  });
  return () => { cancelled = true; };
}, [pageId]);

// ❌ [major] useEffect 로 파생 상태 계산 (이중 렌더링)
useEffect(() => {
  setFilteredPages(pages.filter(p => p.kanbanColumn === col));
}, [pages, col]);

// ✅ 렌더 중 계산 또는 useMemo
const filteredPages = useMemo(
  () => pages.filter(p => p.kanbanColumn === col),
  [pages, col]
);
```

### useMemo / useCallback 적정 사용

```typescript
// ❌ [nit] 불필요한 메모이제이션 (단순 상수)
const config = useMemo(() => ({ timeout: 5000 }), []); // 무의미

// ❌ [nit] React.memo 와 짝이 없는 useCallback
const handleClick = useCallback(() => {
  console.log('click');
}, []); // MemoizedComponent 에 전달하지 않으면 무의미

// ✅ React.memo + useCallback + useMemo 삼위일체
const MemoPage = React.memo(PageCard);
const pages = useMemo(() => getColumnPages(col), [col]);
const handleEdit = useCallback((id: string) => setEditing(id), []);
return <MemoPage pages={pages} onEdit={handleEdit} />;
```

### 컴포넌트 설계

```typescript
// ❌ [major] 컴포넌트 내부에 컴포넌트 정의 (매 렌더마다 새 함수 생성)
function PageList() {
  function PageItem({ page }) { // 매 렌더마다 새 컴포넌트!
    return <div>{page.title}</div>;
  }
  return pages.map(p => <PageItem key={p.id} page={p} />);
}

// ✅ 컴포넌트는 외부에 정의
function PageItem({ page }: { page: Page }) {
  return <div>{page.title}</div>;
}
function PageList() {
  return pages.map(p => <PageItem key={p.id} page={p} />);
}
```

### TypeScript 타입 안전성

```typescript
// ❌ [major] any 사용
function processPage(data: any) { return data.title; }

// ❌ [major] non-null assertion 남용
const title = page!.title!; // 실제 null 이면 런타임 오류

// ✅ unknown + 타입 가드
function processPage(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'title' in data) {
    return String((data as { title: unknown }).title);
  }
  throw new Error('Invalid page data');
}

// ✅ optional chaining + nullish coalescing
const title = page?.title ?? 'Untitled';
```

```typescript
// ❌ [minor] 타입 단언으로 오류 회피
const page = store.getPage(id) as Page;

// ✅ 타입 가드 함수
function isPage(value: unknown): value is Page {
  return typeof value === 'object' && value !== null && 'id' in value;
}
const raw = store.getPage(id);
if (!isPage(raw)) throw new Error(`Page ${id} not found`);
```

---

## Zustand 스토어 패턴

```typescript
// ❌ [critical] 스토어 외부에서 state 직접 수정
useStore.getState().pages[id].title = 'New'; // 인덱스 desync!

// ❌ [major] 새 컴포넌트에서 pagesArray 로 find/filter
const { pagesArray } = useStore();
const page = pagesArray.find(p => p.id === id); // 새 코드에서는 금지

// ✅ 스토어 메소드 + 셀렉터 hook
const page = usePageById(id);
const { updatePageMetadata } = useStore();
await updatePageMetadata(page.filePath, { title: 'New' });
```

새 selector 추가 패턴:
1. `src/store/selectors.ts` 에 pure function 추가
2. `src/hooks/usePageSelectors.ts` 에 hook wrapper 추가
3. 인덱스 의존 시 `src/store/normalizedHelpers.ts` 갱신

---

## 보안 체크리스트

### XSS 방지

```typescript
// ❌ [critical] dangerouslySetInnerHTML 에 비정제 입력
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ DOMPurify 정제 후 사용 (Tiptap 외부 콘텐츠 렌더링 시)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

// ✅ React 기본 escaping 활용
<div>{userContent}</div> // 자동 escape
```

### 파일 경로 순회 방지

```typescript
// ❌ [critical] 사용자 입력으로 직접 파일 경로 구성
const filePath = `${workspaceRoot}/${userInput}`;

// ✅ path.basename 으로 파일명만 추출 후 안전한 경로 구성
import { basename } from '@tauri-apps/api/path';
const safeName = await basename(userInput);
const filePath = `${workspaceRoot}/${safeName}`;
```

### 민감 데이터

```typescript
// ❌ [critical] console.log 에 민감 정보
console.log('Page content:', pageContent); // 내용 유출

// ❌ [major] localStorage 에 민감 설정 저장 (암호화 없이)
localStorage.setItem('apiKey', key);

// ✅ 설정은 configService 통해 .kanban-config.json 에 저장
await configService.updateSetting('theme', 'dark');
```

감지 명령:
```bash
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "// "
grep -rn "dangerouslySetInnerHTML" src/
grep -rn "localStorage\.setItem" src/ | grep -v configService
```

---

## Tiptap 에디터 패턴

```typescript
// ❌ [major] 에디터 인스턴스에 직접 DOM 조작
editor.view.dom.innerHTML = content;

// ✅ Tiptap 커맨드 API 사용
editor.commands.setContent(content);

// ❌ [major] 에디터 외부에서 document 레벨 이벤트 등록
document.addEventListener('keydown', handleKey); // 스코프 없는 핸들러

// ✅ 에디터 컨테이너에 스코프된 핸들러
editorContainerRef.current?.addEventListener('keydown', handleKey);
// cleanup 필수
return () => editorContainerRef.current?.removeEventListener('keydown', handleKey);
```

---

## 성능 레드 플래그

```typescript
// ❌ [major] 매 렌더마다 새 객체/함수를 props 로 전달 (memo 컴포넌트에)
<MemoizedCard
  style={{ color: 'red' }}    // 새 객체
  onClick={() => edit(id)}    // 새 함수
/>

// ❌ [major] 대용량 페이지 목록 가상화 없이 렌더
{pages.map(p => <PageCard key={p.id} page={p} />)} // 1000개면?

// ❌ [minor] 불필요한 전체 파일 쓰기 (메타데이터 변경에 updatePage 사용)
await pageService.updatePage(page); // content 안 바뀌었는데 전체 rewrite
```

---

## 심각도 기준

| 레이블 | 조건 | 머지 차단 |
|--------|------|----------|
| 🔴 `[critical]` | 핵심 규칙 위반 (FS 직접 접근, 인덱스 desync, MCP type drift, XSS) | ✅ |
| 🟡 `[major]` | write amplification, O(n) 조회, `any` 사용, 하드코딩 색상, missing cleanup | 권고 |
| 🟢 `[minor]` | 불필요한 메모이제이션, 타입 단언, nit-pick 수준 아님 | ❌ |
| 💬 `[nit]` | 네이밍, 주석, 코드 스타일 선호 | ❌ |
| 💡 `[suggestion]` | 더 나은 대안 제시, 블로킹 아님 | ❌ |
| 🎉 `[praise]` | 잘 된 구현, 패턴 준수 | ❌ |

---

## 리뷰 체크리스트

### 서비스 레이어

- [ ] FS 접근이 `fileSystemService` 를 통하는가
- [ ] 이미지 처리가 `imageService` 를 통하는가
- [ ] 페이지 CRUD 가 `pageService` 를 통하는가
- [ ] 메타데이터만 변경 시 `updatePageMetadata` 사용하는가
- [ ] 새 FS 기능이 service 에 추가되었는가 (컴포넌트 직접 호출 없음)

### Normalized State

- [ ] `pages.find/filter` 직접 호출 없는가
- [ ] 새 컴포넌트가 `usePageSelectors.ts` hook 을 사용하는가
- [ ] store state 를 직접 mutate 하지 않는가
- [ ] 새 파생 데이터가 `selectors.ts` → `usePageSelectors.ts` 순서로 추가되었는가

### MCP Type Sync

- [ ] `src/types/page.ts` 변경 없음, 또는
- [ ] 변경 있고 `mcp-pale-blue-dot-server/dist/` 가 rebuild 됨

### React Hooks

- [ ] Hooks 가 컴포넌트 최상단에서 호출되는가
- [ ] `useEffect` 의존 배열이 완전한가
- [ ] `useEffect` cleanup 함수가 있는가 (구독/타이머/요청)
- [ ] 파생 상태를 `useEffect` 가 아닌 `useMemo` 로 계산하는가

### TypeScript

- [ ] `any` 사용 없는가
- [ ] Non-null assertion(`!`) 최소화되었는가
- [ ] `unknown` + 타입 가드 패턴을 사용하는가
- [ ] 유니온 타입에 올바른 타입 내로잉이 있는가

### CSS

- [ ] 하드코딩 색상값 없이 CSS 변수(`var(--...)`)를 사용하는가
- [ ] CSS modules 없이 컴포넌트별 CSS 파일로 스코프되는가

### 보안

- [ ] `dangerouslySetInnerHTML` 사용 시 DOMPurify 정제하는가
- [ ] 사용자 입력으로 파일 경로 구성 시 검증하는가
- [ ] `console.log` 에 민감 데이터 없는가

### 테스트

- [ ] 새 기능에 통합 테스트가 있는가
- [ ] service 변경에 단위 테스트가 있는가
- [ ] `@testing-library/react` + `userEvent` 를 사용하는가
- [ ] store 테스트가 selector hook 을 통해 검증하는가

---

## 자주 나타나는 안티패턴 (Red Flags)

빠른 스캔을 위한 grep 명령 모음:

```bash
# 핵심 규칙 위반
grep -rn "pages\.find\|pages\.filter\|pagesArray\.find" src/components/ src/hooks/
grep -rn "showOpenFilePicker\|showSaveFilePicker" src/components/
grep -rn "\.innerHTML\s*=" src/ --include="*.tsx" --include="*.ts"
grep -rn "dangerouslySetInnerHTML" src/ --include="*.tsx"

# TypeScript 품질
grep -rn ": any\b\|as any\b" src/ --include="*.ts" --include="*.tsx"
grep -rn "@ts-ignore" src/

# 코드 위생
grep -rn "console\.log\|console\.error" src/ --include="*.ts" --include="*.tsx" | grep -v "// "
grep -rn "TODO\|FIXME\|HACK" src/

# CSS
grep -rn "#[0-9a-fA-F]\{3,6\}" src/components/ --include="*.css"
```
