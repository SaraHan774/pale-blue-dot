# Rule: Commit Safety

## When this applies

worker / 사용자가 commit / push / branch 조작을 하는 모든 시점.

## Rule

1. **--no-verify 금지**: `git commit --no-verify` / `git push --no-verify` 사용 금지. pre-commit hook 이 실패하면 그 사유를 해결하고 재커밋 (NEVER amend — 새 commit 생성).

2. **force push 금지**:
   - `git push --force` / `git push -f` 금지
   - main 또는 보호 브랜치에는 절대 force push 안 함
   - `--force-with-lease` 도 사용자 명시적 요청 없이는 사용 금지

3. **destructive command 는 사용자 확인**:
   - `git reset --hard`, `git checkout .`, `git restore .`, `git clean -f`, `git branch -D` → 사용자 확인 후 실행
   - 실수로 in-progress 작업이 있을 수 있으므로 먼저 `git status` 로 상태 보고

4. **secret 파일 commit 금지**: `.env`, `*.local`, `credentials.json`, `*-keystore.*` 가 untracked 또는 staged 인 채로 add 하지 말 것. `.gitignore` 에 누락된 게 발견되면 즉시 추가.

5. **scope 별 staging**: `git add -A` / `git add .` 지양. 변경된 파일을 명시적으로 add. 의도하지 않은 파일 (생성된 dist, node_modules 누락분 등) 의 우발 commit 방지.

6. **worker 의 commit 권한**: worker agent 는 worktree 안에서 자체 commit 가능하나 push 는 안 함. push 는 사용자가 직접 또는 `/release-build` 호출로.

7. **commit 메시지 스타일** (CLAUDE.md 기존 규약):
   - 1-2 문장
   - "왜" > "무엇"
   - 끝에 `Co-Authored-By: <model> <noreply@anthropic.com>` (사용자가 작성한 게 아닐 때)

## Why

- `--no-verify` 는 hook 의 보호를 우회 — pre-commit lint / 타입체크 / 테스트가 깨진 채로 머지될 위험
- force push 는 다른 작업의 커밋을 silent 하게 덮어씀
- `git add .` 는 secret 파일을 우발적으로 stage 시키는 가장 흔한 경로

## How to apply

- worker: `validation_commands` 통과 후에만 commit. validation 실패 시 commit 안 함.
- reviewer: diff 검토 시 의도하지 않은 파일 (auto-generated, secret-like) 포함 여부 확인 → `critical`.
- 사용자: `/pbd-work` 가 worker 의 commit 을 만들지만 push 는 사용자 책임. `git push` 는 명시적 사용자 행동.
