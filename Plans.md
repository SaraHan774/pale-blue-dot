# Plans

> Pale Blue Dot 프로젝트의 단일 진실 공급원 (SSoT).
> 모든 task 는 여기에 등재되어야 자동화 사이클(`/pbd-work`, `/pbd-review`)의 대상이 된다.

## 상태 마커 (반드시 이 4개만 사용)

| 마커 | 의미 | 작성 권한 |
|------|------|-----------|
| `pm:요청` | 사용자가 task 등록 | 사용자 / `pbd-plan` skill |
| `cc:진행` | worker 가 작업 중 (worktree 격리) | `pbd-work` skill (worker-report 수신 후) |
| `cc:완료` | worker 가 자체 검증 통과 | `pbd-work` skill (worker-report 수신 후) |
| `pm:확인` | 사용자가 검수 완료 | 사용자 / `pbd-plan` skill |

전이: `pm:요청 → cc:진행 → cc:완료 → pm:확인`. 역방향 또는 건너뛰기 금지.

## 골든 룰

1. Active Phase 는 **항상 1개**.
2. `cc:*` 마커는 worker agent 가 **직접 못 쓴다**. `pbd-work` 가 worker-report.v1 수신 뒤 갱신.
3. WIP (`cc:진행`) 가 3개 이상이거나 24시간 이상 정체된 task 가 있으면 monitor 가 경고.
4. Plans.md 에 task 가 없으면 worker 는 작업하지 않는다.

---

## Active Phase

### Phase 4: 파일 편집기 성능 향상을 위한 리팩토링 작업

**시작**: 2026-05-03

| Task | 내용 | DoD | Status |
|------|------|-----|--------|
| T1 | 파일 편집기의 성능 bottle neck 분석 및 해결 계획 수립 | (1) PageView/editor 관련 컴포넌트에서 주요 re-render 병목 3개 이상 식별 (2) 원인·영향 범위·해결 방향을 `docs/editor-perf-analysis.md`에 작성 (3) `npm run build` 통과 | pm:확인 |
| T2 | PageView Zustand 구독 세밀화 | `useStore()` 전체 구독을 field-level selector로 분리, `pagesArray` 사용처를 `selectAllColumns`/`selectAllTags` selector로 교체, `npm run build && npm test` 통과 | pm:요청 |
| T3 | usePageSync 인터페이스 개선 — pages 맵 기반 전환 | `usePageSync`가 `pages: Page[]` 대신 normalized pages map을 사용, `loadPage` 내부 `find`를 O(1) 맵 접근으로 교체, `npm run build && npm test` 통과 | pm:요청 |
| T4 | PageEditor keyboard shortcut & editorRef effect 최적화 | keyboard shortcut `useEffect` 의존성 배열을 `[]`로 축소(ref 패턴), editorRef `useEffect` dependency array 추가, `npm run build && npm test` 통과 | pm:요청 |
| T5 | useHighlightHoverTooltip 이벤트 위임으로 교체 | MutationObserver 콜백에서 이벤트 핸들러 일괄 재등록 제거 → 컨테이너 이벤트 위임으로 대체, 하이라이트 20개 이상 페이지에서 타이핑 lag 없음 확인, `npm run build && npm test` 통과 | pm:요청 |

---

## 보관 (Archived Phases)

### Phase 3: MCP 서버 리팩토링 (archived 2026-05-03)

**시작**: 2026-05-03 / **종료**: 2026-05-03

| Task | 내용 | 최종 Status |
|------|------|------------|
| T1 | MCP 서버 index.ts 모듈 분리 (841줄 → 9개 모듈) | pm:확인 |

---

### Phase 2: 버그 수정 (archived 2026-05-03)

**시작**: 2026-05-01 / **종료**: 2026-05-03

| Task | 내용 | 최종 Status |
|------|------|------------|
| T1 | 이미지 엑박 수정 | pm:확인 |
| T2 | compact view 소형 창 column 레이아웃 수정 | pm:확인 |

---

## 보관 (Archived Phases)

### Phase 1: Harness Pattern 도입 (archived 2026-05-01)

**시작**: 2026-05-01
**종료**: 2026-05-01 (T5 폐기, 사용자 요청으로 archive)

| Task | 내용 | 최종 Status |
|------|------|------------|
| T1 | Phase 0 부트스트랩 | cc:완료 |
| T2 | Verb skills 4개 | cc:완료 |
| T3 | Sub-agents 3개 + worker-report.v1 스키마 | cc:완료 |
| T4 | Rules 6개 + CLAUDE.md 섹션 추가 | cc:완료 |
| T5 | Dogfood 검증 (T_DEMO 사이클) | 폐기 (pm:요청 상태에서 사용자 요청으로 종료) |
