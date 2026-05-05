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

### Phase 8: PBD 에디터 인터랙티브 체크박스

**시작**: 2026-05-05
**대상**: `src/components/TiptapEditor.tsx`, `src/pages/PageView.css`

| Task | 내용 | Status |
|------|------|--------|
| T1 | TiptapEditor 체크박스 인터랙션 구현 — DoD: `@tiptap/extension-task-list` + `@tiptap/extension-task-item` 설치 및 TiptapEditor extensions 배열에 추가(`TaskItem.configure({ nested: true })`); `- [ ]` / `- [x]` 마크다운이 인터랙티브 체크박스로 렌더링; **체크박스 아이콘 영역 클릭만** 토글 트리거(텍스트 클릭은 편집); 체크 색상 `accent-color: var(--accent-primary)` 적용; 완료 항목에 `line-through + opacity 0.6` CSS(`li[data-checked="true"]` 셀렉터); 중첩 하위 체크박스 허용(Tab 들여쓰기); `tiptap-markdown`이 저장 시 GFM `- [ ]`/`- [x]` 형식 유지 확인; `npm run build` + `npx tsc --noEmit` 통과 | cc:완료 |

---

## 보관 (Archived Phases)

> 완료된 Phase 는 [Plans.archive.md](Plans.archive.md) 에 보관됩니다.
> `/pbd-plan archive` 호출 시 자동으로 이전됩니다.
