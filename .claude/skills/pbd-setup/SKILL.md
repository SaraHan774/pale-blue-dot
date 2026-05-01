---
name: pbd-setup
description: Pale Blue Dot harness 부트스트랩 / 마이그레이션 / 점검. 멱등 동작
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: "init | check | upgrade"
effort: medium
---

# pbd-setup

harness 디렉토리·파일을 부트스트랩하거나 점검한다. **모든 동작은 멱등** — 이미 존재하는 파일은 덮어쓰지 않고 보고만 한다.

## 호출 예

- `/pbd-setup init` — 처음 도입 시 (없는 파일만 생성)
- `/pbd-setup check` — 무결성 점검 (없는 파일 / 깨진 frontmatter 보고)
- `/pbd-setup upgrade` — 새 버전의 정식 템플릿이 추가됐을 때 사용자 확인 후 갱신

## 동작 정의

### init

다음 파일·디렉토리가 존재하는지 차례로 확인하고, 없는 것만 만든다:

```
Plans.md
.pbd-harness.yaml
.claude/output-styles/pbd-ops.md
.claude/monitors/monitors.json
.claude/skills/pbd-{setup,plan,work,review}/SKILL.md
.claude/agents/{advisor,reviewer,worker}.md
.claude/rules/{plans-management,service-layer,mcp-type-sync,normalized-state,test-quality,commit-safety}.md
.claude/templates/{plans-phase.md,worker-report.json}
```

생성한 항목 / 이미 있던 항목 / 누락된 의존 항목을 표로 보고:

```
**생성됨**: 2 (.claude/templates/plans-phase.md, ...)
**이미 존재**: 18
**누락 (수동 확인 필요)**: 0
```

### check

무결성 점검:

1. 위 모든 파일이 존재하는가?
2. 각 SKILL.md / agent.md 가 유효한 YAML frontmatter 를 갖는가?
3. Plans.md 에 Active Phase 섹션이 1개만 있는가?
4. `.pbd-harness.yaml` 의 필수 키 (review, advisor, worker, monitor) 가 모두 있는가?
5. monitors/monitors.json 이 유효한 JSON 인가?

문제는 ❌ 로 표시하고 수정 명령을 제안.

### upgrade

`/pbd-setup upgrade` 는 사용자에게 변경 diff 를 먼저 보여주고, 명시적 동의(Y/N)를 받기 전엔 어떤 파일도 수정하지 않는다.

## Plans.md 와의 관계

`pbd-setup` 자체는 Plans.md 의 task 마커를 변경하지 않는다 (마커는 `pbd-plan` 또는 `pbd-work` 만 갱신).

## 응답 포맷

설치/점검 결과는 [output-styles/pbd-ops](../../output-styles/pbd-ops.md) 의 Work phase 규칙을 따른다.
