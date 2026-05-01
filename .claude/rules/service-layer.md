# Rule: Service Layer 분리

## When this applies

`src/services/**` 의 파일을 수정하거나, 컴포넌트에서 파일 시스템 / 이미지 / 페이지 데이터에 접근할 때.

## Rule

1. **fs/이미지/페이지 접근은 service 를 통해서만**:
   - 파일 시스템: [`src/services/fileSystemService`](../../src/services/) — 직접 `window.showOpenFilePicker` 또는 Tauri `fs` API 호출 금지
   - 이미지: `src/services/imageService` — content hashing / 중복 제거가 자동 처리됨
   - 페이지 CRUD: `src/services/pageService` — YAML frontmatter 와 파일명 규칙 캡슐화

2. **플랫폼 추상화**: `fileSystemFactory.ts` 가 런타임에 browser FS Access API vs Tauri FS plugin 을 선택. 컴포넌트는 어떤 플랫폼인지 알 필요 없다.

3. **`updatePage` vs `updatePageMetadata` 선택**:
   - 메타데이터만 변경 (column, tag, pin, title, dueDate) → **`pageService.updatePageMetadata(path, { ... })`** 사용
   - content 가 함께 변경 → `pageService.updatePage(page)` 사용
   - 잘못 선택하면 write amplification (CLAUDE.md 의 Performance Architecture 섹션 참조)

4. **MCP 서버와 타입 공유**: `mcp-pale-blue-dot-server` 는 `src/types/page.ts` 를 직접 import. `Highlight` / `Memo` 타입 변경 시 [mcp-type-sync](mcp-type-sync.md) 적용.

## Why

- 플랫폼 추상화가 깨지면 PWA 와 Tauri 빌드가 분기되어 유지보수 비용 폭발.
- `updatePageMetadata` 를 안 쓰면 메타데이터 1개 바꿀 때마다 전체 파일 rewrite — `updatePage` 는 96-98% 느림 (CLAUDE.md 의 Performance Architecture).
- service 추상화를 우회하면 image dedup / content hashing / 마이그레이션 로직을 잃는다.

## How to apply

- 컴포넌트에서 새로운 fs 접근 필요 시 → 먼저 `fileSystemService` 에 메소드 있는지 확인. 없으면 service 에 추가하고 컴포넌트는 service 만 호출.
- 메타데이터만 바꾸는 코드를 작성한다면 `updatePageMetadata` 가 첫 번째 선택지.
- 새 service 함수 추가 시 호출자 grep (`grep -r "from.*<serviceName>" src/`) 으로 영향 범위 보고.
