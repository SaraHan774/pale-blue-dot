# Rule: Normalized State 사용

## When this applies

컴포넌트 또는 hook 에서 Zustand store 의 페이지 데이터에 접근할 때.

## Rule

1. **직접 array find/filter 금지**:
   - ❌ `const page = pages.find(p => p.id === id)`
   - ✅ `const page = usePageById(id)`
   - ❌ `const todos = pages.filter(p => p.kanbanColumn === 'To Do')`
   - ✅ `const todos = usePagesByColumn('To Do')`
   - ❌ `const children = pages.filter(p => p.parentId === parentId)`
   - ✅ `const children = useChildPages(parentId)`

2. selector 는 [`src/store/selectors.ts`](../../src/store/selectors.ts), hook 은 [`src/hooks/usePageSelectors.ts`](../../src/hooks/usePageSelectors.ts) 에 있다. 새 파생 데이터가 필요하면 거기 추가.

3. **인덱스 무결성**: `pages` 를 직접 mutate 하면 `columnIndex` / `tagIndex` / `parentIndex` 와 desync. store 메소드 (`addPage`, `updatePage`, `removePage`, `updatePageMetadata`) 만 사용.

4. **`pagesArray` 는 backward-compat 용**: 새 코드에서는 가능하면 selector 사용. `pagesArray` 는 기존 컴포넌트가 마이그레이트되기 전까지의 다리.

## Why

CLAUDE.md 의 Performance Architecture (2026-03-07):

- 인덱스 사용 시 column/tag/children 조회가 **O(1)**
- 직접 `find/filter` 는 **O(n)** — 페이지 수 늘어나면 렌더가 느려짐
- 측정 결과: 97-99% 빨라짐

또 인덱스를 우회하면 다음 변경에서 stale 데이터를 볼 위험.

## How to apply

- 새 컴포넌트 작성 시 `usePageSelectors.ts` 의 hook 들을 먼저 확인
- 기존 코드에서 `pages.find/filter` 발견 시 reviewer 가 `major` 로 표시 (성능 영향)
- 새 selector 추가 시: ① `selectors.ts` 에 pure function ② `usePageSelectors.ts` 에 hook wrapper ③ 인덱스에 의존한다면 `normalizedHelpers.ts` 의 인덱스 갱신 함수에도 반영
