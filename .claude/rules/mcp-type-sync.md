# Rule: MCP Server Type Sync

## When this applies

`src/types/page.ts` 의 `Highlight` 또는 `Memo` 타입을 수정한 모든 변경.

(다른 타입 — `Page`, `KanbanSettings` 등 — 도 MCP 서버에서 사용되면 동일 적용. import 경로 확인.)

## Rule

1. `src/types/page.ts` 의 MCP 사용 타입을 수정했다면, **같은 PR/커밋 내에서** 다음을 수행해야 함:

   ```bash
   cd mcp-pale-blue-dot-server && npm run build
   ```

2. 빌드 결과 (`mcp-pale-blue-dot-server/dist/`) 도 함께 커밋. 빌드 안 하고 머지 시 MCP 도구가 stale 한 타입으로 동작.

3. worker-report.v1 의 `self_review.mcp_type_sync` 항목에 다음 두 boolean 모두 응답 필수:
   - `needed: true/false` (타입 변경이 있었는가)
   - `done: true/false` (rebuild 했는가)

   `needed: true && done: false` 는 reviewer 가 자동으로 `critical` 로 분류.

4. reviewer 는 worker-report 의 `mcp_type_sync.needed: true` 인 경우 빌드 결과물의 mtime 이 `src/types/page.ts` 보다 새로움을 확인.

## Why

MCP 서버가 import 하는 타입은 TypeScript Single Source of Truth. 컴파일 산출물이 stale 하면 frontend 와 MCP tool 사이에 silent drift 가 생기고, AI agent 가 잘못된 스키마로 메모/하이라이트를 만들어 워크스페이스를 오염시킨다.

## How to apply

- worker: `src/types/page.ts` 변경 직후 `cd mcp-pale-blue-dot-server && npm run build` 자동 실행 → worker-report 의 `mcp_type_sync.done: true` 기록
- reviewer: `mcp_type_sync.needed: true` 일 때 mtime 비교 (`stat -f "%m" src/types/page.ts mcp-pale-blue-dot-server/dist/index.js`)
- output style 의 phase-aware 알림이 MCP 변경 감지 시 자동으로 rebuild 명령 출력
- monitor: `pbd-mcp-type-drift` 가 session_start 마다 mtime 차이 확인
