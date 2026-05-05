---
name: pbd-plan
description: Plans.md 의 phase / task 를 생성·추가·갱신·동기화. pm:* 마커는 이 skill 만 작성
allowed-tools: Read, Edit, Write, Glob, Grep
argument-hint: "create | add | update | sync | archive [args]"
effort: medium
---

# pbd-plan

Plans.md 를 단일 진실 공급원(SSoT)으로 유지한다. `pm:*` 마커(`pm:요청`, `pm:확인`)는 **이 skill 또는 사용자만** 직접 작성할 수 있다.

## 호출 예

| 명령 | 동작 |
|------|------|
| `/pbd-plan create "Phase 2: 사이드바 개선"` | 새 phase 시작. 기존 active phase 가 있으면 archive 제안 |
| `/pbd-plan add "T7: 검색 디바운스 추가 (DoD: 250ms 디바운스, 테스트 1개)"` | active phase 에 task 추가 (`pm:요청` 마커) |
| `/pbd-plan update T7 --status pm:확인` | task 상태 갱신 (전이 규칙 검증 후) |
| `/pbd-plan update T7 --dod "..." --depends T5` | task 메타 수정 |
| `/pbd-plan sync` | Plans.md 와 git 상태 일관성 점검 (parsing 오류, orphan task 등) |
| `/pbd-plan archive` | active phase 의 모든 task 가 `pm:확인` 이면 `Plans.archive.md` 끝에 append 후 Plans.md 에서 제거 |

## 상태 전이 규칙 (반드시 검증)

```
pm:요청 → cc:진행 → cc:완료 → pm:확인
```

- 역방향 금지 (`cc:완료 → cc:진행` 같은 transitions 거부, 단 사용자가 `--force` 옵션을 명시한 경우 허용)
- 건너뛰기 금지 (`pm:요청 → cc:완료` 같은 직접 transitions 거부)
- `cc:*` 로의 갱신은 이 skill 에서는 실행하지 않고, "worker 가 자동 갱신함" 안내만 출력

## task ID 규칙

- 형식: `T<숫자>` 또는 `T_<라벨>` (예: `T1`, `T_DEMO`)
- 같은 phase 안에서 ID 중복 금지
- ID 충돌 시 사용자에게 다음 사용 가능한 ID 제안

## DoD 작성 가이드

DoD 가 비어 있으면 task 를 추가하지 않는다 (사용자에게 DoD 입력 요청). 좋은 DoD 의 조건:

- 측정 가능 (테스트 / 빌드 / 동작 시나리오)
- worker 가 자체 검증 가능 (`npm run lint && npm run build && npm test` 등으로 확인 가능한 형태 우선)

## archive 절차 (`/pbd-plan archive`)

1. **사전 검증**: active phase 의 모든 task 가 `pm:확인` 인지 확인. 미완료 task 가 있으면 목록을 보여주고 중단.
2. **Plans.archive.md append**: `Plans.archive.md` 파일 끝에 해당 phase 섹션을 그대로 추가. 파일이 없으면 새로 생성.
3. **Plans.md 정리**: Active Phase 섹션 전체를 제거. `보관 (Archived Phases)` 섹션은 포인터 문구(`Plans.archive.md` 링크)만 유지.
4. **확인 출력**: "Phase N → Plans.archive.md 이전 완료" 메시지 출력.

> Plans.archive.md 는 append-only. 기존 내용을 수정하거나 삭제하지 않는다.

## active phase 1개 원칙

`/pbd-plan create` 호출 시 이미 active phase 가 있으면:

1. 기존 phase 의 unfinished task 목록 표시
2. 사용자에게 선택 요청: (a) 기존 phase 이어가기 (b) 미완료 task 를 새 phase 로 이관 (c) 미완료 task 폐기 후 archive
3. (b) 또는 (c) 후에만 새 phase 생성

## 응답 포맷

[output-styles/pbd-ops](../../output-styles/pbd-ops.md) 의 Work phase 규칙을 따른다.
