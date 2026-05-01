---
name: pbd-work
description: 단일 task 를 worker agent 에 디스패치 (worktree 격리). worker-report.v1 수신 후 Plans.md 의 cc:* 마커 갱신
allowed-tools: Read, Edit, Bash, Glob, Grep, Agent
argument-hint: "T<n> [--advisor] [--dry-run]"
effort: high
---

# pbd-work

Plans.md 의 단일 task 를 worker agent 에 디스패치한다. 항상 git worktree 로 격리되며, worker 의 self-validation (`npm run lint && npm run build && npm test`) 통과 후 [worker-report.v1](../../templates/worker-report.json) 을 받아 Plans.md 의 마커를 갱신한다.

## 호출 예

| 명령 | 동작 |
|------|------|
| `/pbd-work T1` | T1 을 worker 에 디스패치 |
| `/pbd-work T1 --advisor` | worker 가 막히면 자동으로 advisor 호출 (`.pbd-harness.yaml` 의 `advisor.retry_threshold` 적용) |
| `/pbd-work T1 --dry-run` | 디스패치 없이 task 의 DoD / depends 검증만 |

## 디스패치 전 검증 (모두 통과해야 함)

1. Plans.md 에 해당 task ID 가 존재하는가?
2. task status 가 `pm:요청` 인가? (이미 `cc:진행` 또는 그 이후면 거부)
3. `Depends` 의 모든 task 가 `cc:완료` 또는 `pm:확인` 인가?
4. DoD 가 비어 있지 않은가?
5. 현재 git status 가 깨끗한가? (worktree 생성 전 작업 디렉토리는 깨끗해야 함)

하나라도 실패 시 디스패치 거부 + 사용자에게 수정 명령 제안.

## 디스패치 절차

1. **Plans.md 마커를 `cc:진행` 으로 갱신** (worker 호출 전 — worker 는 이 마커를 직접 못 씀)
2. **worktree 생성**: `git worktree add ../pbd-work-<task-id> -b pbd/<task-id>`
3. **worker agent 호출** ([.claude/agents/worker.md](../../agents/worker.md))
   - 입력: task ID, task 내용, DoD, worktree 경로, 관련 파일 후보 (Glob 으로 추정)
   - worker 는 worktree 안에서만 작업
4. **worker-report.v1 수신** 후 검증:
   - schema 가 [.claude/templates/worker-report.json](../../templates/worker-report.json) 와 일치
   - self_review 5 항목 모두 응답 있음
   - validation 결과 모두 PASS
5. 검증 통과 시 Plans.md 마커를 `cc:완료` 로 갱신
6. 사용자에게 `/pbd-review code` 호출 안내

## worker 가 막히는 경우

`--advisor` 가 켜져 있고 worker 가 N회 (`.pbd-harness.yaml` 의 `advisor.retry_threshold`) 자체 검증 실패 시:

1. advisor agent 호출 ([.claude/agents/advisor.md](../../agents/advisor.md))
2. advisor 의 verdict (PLAN/CORRECTION/STOP) 에 따라:
   - **PLAN**: worker 에 새 plan 전달 후 재시도
   - **CORRECTION**: 특정 파일·라인 수정 지시 전달 후 재시도
   - **STOP**: worker 종료, 사용자에게 보고

`advisor.max_consults_per_task` 를 초과하면 자동으로 STOP.

## 실패 시 정리

worker 가 실패하거나 사용자가 abort 하면:

1. Plans.md 마커를 `pm:요청` 으로 되돌림 (역방향 transition 이지만 이 skill 은 예외적으로 허용)
2. 사용자에게 worktree 폐기 여부 확인 (`git worktree remove ../pbd-work-<task-id>`)
3. 실패 사유와 worker 의 마지막 self_review 출력

## Plans.md 마커 갱신 권한

이 skill 은 `cc:진행` / `cc:완료` 마커를 갱신할 수 있는 **유일한 skill**. worker agent 는 본인이 직접 마커를 갱신하지 못한다 (worker.md 의 `disallowedTools` 와 NG-1 가드 참조).

## 응답 포맷

[output-styles/pbd-ops](../../output-styles/pbd-ops.md) 의 Work phase 규칙을 따른다. worker-report 의 핵심 필드 (variations, files_changed, validation_results) 를 요약 표시.
