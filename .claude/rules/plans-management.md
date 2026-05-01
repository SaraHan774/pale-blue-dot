# Rule: Plans.md 관리

## When this applies

[Plans.md](../../Plans.md) 의 phase / task 를 만들거나, 상태 마커를 갱신하거나, archive 할 때.

## Rule

1. **상태 마커는 4개만**: `pm:요청`, `cc:진행`, `cc:완료`, `pm:확인`. 그 외 마커 사용 금지.
2. **전이는 단방향**: `pm:요청 → cc:진행 → cc:완료 → pm:확인`. 역방향 / 건너뛰기 금지 (예외: `pbd-work` 가 worker 실패 시 `cc:진행 → pm:요청` 으로 되돌리는 것만 허용).
3. **권한 분리**:
   - `pm:*` 마커 → 사용자 또는 `pbd-plan` skill 만 작성
   - `cc:*` 마커 → `pbd-work` skill 만 작성 (worker agent 본인은 직접 못 씀 — NG-1 참조)
4. **Active Phase 1개 원칙**: Plans.md 의 active phase 는 항상 정확히 1개. 새 phase 시작 전에 이전 phase 를 archive 또는 미완 task 이관.
5. **DoD 필수**: task 등록 시 DoD 가 비어 있으면 등록 거부. 좋은 DoD 는 측정 가능 + worker 자체 검증 가능.
6. **task ID 규칙**: `T<숫자>` 또는 `T_<라벨>`. 같은 phase 안에서 중복 금지.
7. **Depends 순환 금지**: `pbd-plan sync` 가 사이클을 검출하면 fail.

## Why

Plans.md 가 흐트러지면 자동화의 근거가 사라진다. 마커가 무질서하면 worker / reviewer 가 어떤 task 를 다뤄야 할지 모르고, 상태가 애매한 task 가 누적되면 monitor 의 drift 경고가 의미 없어진다. 4-state markers + 단방향 전이는 harness 원본의 핵심 contract.

## How to apply

- 새 task 등록 시: `/pbd-plan add` 사용. 직접 Plans.md 수정 지양 (실수 방지).
- 상태 갱신 시: `/pbd-plan update T<n> --status <marker>` 사용. transition 검증이 자동으로 됨.
- archive 시: `/pbd-plan archive` 사용. active phase 의 모든 task 가 `pm:확인` 인지 자동 점검.
