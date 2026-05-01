---
name: pbd-review
description: reviewer agent 디스패치. context fork 격리. DoD 충족 / 회귀 / 안티패턴 검증
allowed-tools: Read, Bash, Glob, Grep, Agent
argument-hint: "code | plan | scope [--security] [--ui-rubric]"
effort: high
---

# pbd-review

[reviewer agent](../../agents/reviewer.md) 를 디스패치한다. **항상 context fork 격리** — 메인 대화의 다른 컨텍스트가 verdict 에 영향을 주지 않게 한다.

## 호출 예

| 명령 | 동작 |
|------|------|
| `/pbd-review code` | 가장 최근 `cc:완료` task 의 변경 코드 리뷰 |
| `/pbd-review code --task T7` | 특정 task 의 변경 코드 리뷰 |
| `/pbd-review plan` | Plans.md 의 active phase 자체를 리뷰 (DoD 명확성, 의존성, 누락) |
| `/pbd-review scope` | 변경의 영향 범위 분석 (서비스 호출자 / MCP 타입 영향 / 회귀 가능성) |
| `/pbd-review code --security` | reviewer 에 보안 룹릭 활성화 (XSS, command injection, secret 노출) |
| `/pbd-review code --ui-rubric` | UI 변경에 frontend-design 룹릭 활성화 (접근성, 키보드 탐색, 상태 표시) |

## 리뷰 절차

### code 리뷰

1. 대상 task ID 자동 결정 (가장 최근 `cc:완료` 또는 `--task` 인자)
2. 해당 task 의 worktree (`pbd/<task-id>` 브랜치) 와 main 의 diff 추출
3. reviewer 에 입력: diff + task 의 DoD + 영향 받는 서비스/컴포넌트 후보 + (옵션) 보안/UI 룹릭
4. reviewer 가 verdict 반환:
   - `APPROVE` — 사용자에게 `/pbd-plan update T<n> --status pm:확인` 안내
   - `REQUEST_CHANGES` — findings 의 각 항목별로 다음 행동 제안 (`/pbd-work T<n>` 재호출 / 새 task 생성)
   - `COMMENT` — 머지/검수에 영향 없음, 정보 제공만

### plan 리뷰

active phase 의 task 표 자체를 리뷰. 점검 항목:

- DoD 가 측정 가능한가?
- 의존 그래프에 cycle 이 없는가?
- 우선순위가 명확한가?
- 누락된 task (예: 테스트, 문서화) 가 있는가?

### scope 리뷰

변경의 blast radius 점검:

- service layer 변경 시 호출자 그래프 (`grep -r "from.*pageService" src/`)
- `src/types/page.ts` 변경 시 MCP 서버 영향
- store 변경 시 selector / hook 영향
- CSS 변경 시 다른 컴포넌트 영향

## 핵심 원칙

- **REQUEST_CHANGES 는 critical / major 증거가 있을 때만**. minor / nit 은 COMMENT 로 분류.
- reviewer 는 코드 편집 권한이 없다. 발견 사항만 보고하고 수정은 worker 가 한다.
- 같은 task 에 대한 reviewer 호출은 최대 3회까지 자동 허용. 그 이상은 사용자 확인 필요.

## 응답 포맷

[output-styles/pbd-ops](../../output-styles/pbd-ops.md) 의 Review phase 규칙을 따른다:

```
**Verdict**: APPROVE | REQUEST_CHANGES | COMMENT
**Findings**:
  - [critical] ...
  - [major] ...
  - [minor] ...
**Next action**: ...
```
