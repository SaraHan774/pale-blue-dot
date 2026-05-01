# Rule: Test Quality

## When this applies

새 기능 / 버그 수정에 테스트를 추가하거나 기존 테스트를 수정할 때.

## Rule

1. **선호도**:
   1. **통합 테스트** (component + store + service 함께) 가 첫 번째 선택지
   2. service 단위 테스트 (file system / page service 로직)
   3. utility 단위 테스트 (markdown parser, link service 등)
   4. UI snapshot 은 마지막 — 안정적인 보호망 못 됨

2. **fileSystem 모킹은 service 경계에서만**: `pageService` 단위 테스트에서 `fileSystemService` 를 모킹하는 것은 OK. 하지만 컴포넌트 레벨 통합 테스트에서는 `fileSystemService` 의 in-memory 구현체를 사용하는 게 더 안전.

3. **store 테스트는 selector 기준**: store 직접 접근보다 selector / hook 을 통해 검증. 인덱스 일관성도 함께 검증 (예: `addPage` 후 `usePagesByColumn` 결과 확인).

4. **MCP 타입 변경 시 테스트 갱신**: `Highlight` / `Memo` 타입 변경 시 관련 테스트의 fixture 도 갱신. fixture stale 하면 빌드는 통과해도 런타임 데이터 모양이 어긋남.

5. **DoD 가 측정 가능한 task 는 반드시 테스트**: `pbd-plan` 에서 등록되는 task 의 DoD 가 "X 동작이 정확히 Y 한다" 형식이면 worker 가 그 동작을 verify 하는 테스트 1개 이상 추가. 안 했으면 worker-report 의 `tests_added.skip_reason` 에 명시 필수.

## Why

- 모킹된 fs 로 통과한 테스트가 실제 환경에서 깨지는 사례가 많음 (browser FS Access vs Tauri FS plugin 미묘한 차이).
- 통합 테스트가 회귀 보호의 본체. 단위 테스트는 보조.
- snapshot 만 있으면 의미 있는 동작 변화도 단순 텍스트 차이로 보여 noise 가 커짐.

## How to apply

- vitest 사용 (`npm test`).
- 새 기능 PR 의 reviewer 점검: 테스트가 동작 검증인지 vs. 형태 검증인지 구분. 형태만 검증하면 `minor`.
- worker-report 의 `tests_added.answer === "none"` 인 경우 `skip_reason` 필수. reviewer 는 그 사유의 합리성 평가.
