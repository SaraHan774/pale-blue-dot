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

### Phase 6: reader-mobile 하이라이트 지원

**시작**: 2026-05-05
**대상**: `reader-mobile/` (React Native + Expo)

| Task | 내용 | Status |
|------|------|--------|
| T1 | `<mark>` 태그 파싱 및 하이라이트 색상 렌더링 — DoD: MarkdownRenderer가 `data-highlight-color` 속성을 읽어 배경색이 적용된 텍스트로 렌더링됨, `npx tsc --noEmit` 통과, 통합 테스트 1개 | cc:완료 |
| T2 | 텍스트 선택 시 하이라이트 생성 — touch 기반 버블 메뉴 — DoD: 롱프레스로 텍스트 선택 후 색상 버튼 탭 시 `<mark>` 태그가 content에 삽입되고 cacheService로 저장됨, `npx tsc --noEmit` 통과 | pm:요청 |
| T3 | 기존 하이라이트 탭 시 색상 변경·삭제 팝오버 — DoD: 하이라이트 텍스트 탭으로 팝오버 오픈, 색상 변경·삭제 후 저장 확인, `npx tsc --noEmit` 통과 | pm:요청 |
| T4 | 메모 바텀 시트 — DoD: 하이라이트 탭 시 linked memo 조회·작성 가능한 바텀 시트 노출, `Memo` 타입을 `types/index.ts`에 추가, `npx tsc --noEmit` 통과 | pm:요청 |
| T5 | 전체 통합 및 에뮬레이터 회귀 점검 — DoD: Pixel 9 Pro 에뮬레이터에서 T1~T4 기능 동작 확인, `npx tsc --noEmit` 통과, 기존 페이지 뷰 회귀 없음 | pm:요청 |

---

## 보관 (Archived Phases)

### Phase 5: List View UI 개선 (archived 2026-05-05)

**시작**: 2026-05-05 / **종료**: 2026-05-05

| Task | 내용 | 최종 Status |
|------|------|------------|
| T1 | List View 가독성 및 탐색 용이성 개선 | pm:확인 |
| T2 | list-cell-title ellipsis 회귀 수정 | pm:확인 |

---

### Phase 4: 파일 편집기 성능 향상을 위한 리팩토링 작업 (archived 2026-05-03)

**시작**: 2026-05-03 / **종료**: 2026-05-03

| Task | 내용 | 최종 Status |
|------|------|------------|
| T1 | 파일 편집기의 성능 bottle neck 분석 및 해결 계획 수립 | pm:확인 |
| T2 | PageView Zustand 구독 세밀화 | pm:확인 |
| T3 | usePageSync 인터페이스 개선 — pages 맵 기반 전환 | pm:확인 |
| T4 | PageEditor keyboard shortcut & editorRef effect 최적화 | pm:확인 |
| T5 | useHighlightHoverTooltip 이벤트 위임으로 교체 | pm:확인 |

---

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
