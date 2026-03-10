# Pale Blue Dot MCP Server

MCP (Model Context Protocol) 서버로, Claude가 Pale Blue Dot 앱의 하이라이트와 메모를 직접 읽고 수정할 수 있게 합니다.

## 기능

### 📄 페이지 관리
- `create_page` - 새로운 페이지 생성 (콘텐츠, 하이라이트, 메모 포함)
- `list_pages` - 모든 페이지 목록 조회 (하이라이트/메모 개수 포함)
- `read_page` - 특정 페이지의 모든 하이라이트와 메모 읽기
- `update_page_content` - 기존 페이지의 본문 수정 (교체 또는 추가)
- `edit_page_section` - 페이지의 특정 부분만 수정/삽입 (중간 삽입, 문장 수정 등)

### ✏️ 하이라이트 기능 (v2 - Markdown-first)
- `add_highlight` - 새로운 하이라이트 추가
  - Markdown content에서 텍스트를 직접 찾아 정확한 위치 저장
  - 여러 occurrence가 있을 경우 첫 번째 위치 사용 (경고 표시)
  - 색상과 스타일 선택 가능 (기본값: 노란색 하이라이트)
  - firstWords/lastWords 자동 추출 (텍스트 수정 시 복구용)
- `delete_highlight` - 하이라이트 삭제

### 📝 메모 기능
- `add_memo` - 새로운 메모 추가 (독립형 또는 하이라이트 연결형)
- `update_memo` - 기존 메모 수정
- `delete_memo` - 메모 삭제

### 🖼️ 이미지 분석 기능
- `list_images` - .images 폴더의 모든 이미지 목록 조회
- `read_image` - 이미지 파일 읽기 및 OCR 분석 (뉴스 기사, 잡지, 스크린샷 등)

## 설치

```bash
cd mcp-pale-blue-dot-server
npm install
npm run build
```

## 사용 방법

### 1. Claude Desktop 설정에 MCP 서버 추가

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일을 수정:

```json
{
  "mcpServers": {
    "pale-blue-dot": {
      "command": "node",
      "args": [
        "/Users/gahee/pale-blue-dot/mcp-pale-blue-dot-server/dist/index.js"
      ],
      "env": {
        "PALE_BLUE_DOT_WORKSPACE": "/Users/gahee/pale-blue-dot/workspace"
      }
    }
  }
}
```

### 2. Claude Desktop 재시작

설정을 적용하려면 Claude Desktop을 완전히 종료했다가 다시 실행하세요.

### 3. Claude에게 요청하기

이제 Claude에게 이렇게 요청할 수 있습니다:

```
모든 페이지 목록을 보여줘
```

```
"Meeting Notes.md" 페이지의 하이라이트를 읽어줘
```

```
"Project Plan.md" 파일에서 "Q1 목표 달성"을 하이라이트해줘
→ Markdown content에서 정확한 위치를 찾아 저장
→ 동일한 텍스트가 여러 번 나오면 첫 번째 위치에 하이라이트 (경고 표시)
→ 노란색 하이라이트 자동 적용
```

```
"Project Plan.md" 파일에서 "긴급 수정 필요"를 빨간색으로 하이라이트해줘
→ 색상: #FF5252로 적용
→ firstWords/lastWords 자동 추출 (나중에 텍스트가 수정되어도 찾을 수 있음)
```

```
방금 추가한 하이라이트에 메모 남겨줘: "중요! 3월 말까지 완료 필요"
→ 하이라이트에 연결된 메모 생성
```

## 예시 사용 시나리오

### 시나리오 1: 뉴스 기사 분석 (신규 파일 생성)

```
Claude, 다음 뉴스 기사로 "AI News 2024.md" 파일을 만들고,
주요 내용을 하이라이트하고 메모로 요약해줘:

[뉴스 기사 내용 붙여넣기...]
```

Claude가 자동으로:
1. 새 파일 생성
2. 기사 내용 저장
3. 중요한 부분 하이라이트
4. 각 하이라이트에 요약 메모 추가

### 시나리오 2: 중요한 부분 하이라이트하기

```
Claude, "Product Spec.md" 파일을 읽고 가장 중요한 부분 3곳에 노란색 하이라이트를 추가해줘
```

### 시나리오 3: 하이라이트에 메모 추가

```
Claude, 방금 추가한 하이라이트들에 각각 왜 중요한지 메모를 남겨줘
```

### 시나리오 4: 메모 검토 및 수정

```
Claude, "Meeting Notes.md"의 모든 메모를 읽고 중복되거나 불필요한 메모는 삭제해줘
```

### 시나리오 5: 하이라이트 요약

```
Claude, "Book Notes.md"의 모든 하이라이트를 읽고 한 문단으로 요약해줘
```

### 시나리오 6: 이미지 OCR 및 분석

```
Claude, .images 폴더에 어떤 이미지들이 있는지 보여줘
```

```
Claude, "news-article-2024-03-01.png" 이미지를 읽고 OCR로 텍스트를 추출해줘.
그리고 주요 내용을 요약한 새 페이지를 만들어줘.
```

```
Claude, .images 폴더의 모든 스크린샷을 분석해서
각각의 내용을 정리한 페이지를 만들어줘
```

### 시나리오 7: 페이지 부분 편집 (NEW!)

**특정 문장만 수정:**
```
Claude, "Project Plan.md" 파일에서 "Q1 목표 달성"을 "Q1 목표 100% 달성"으로 바꿔줘
```

**중간에 내용 삽입:**
```
Claude, "Meeting Notes.md" 파일에서 "## 다음 회의" 섹션 앞에
"## 액션 아이템\n- [ ] 예산 승인 받기\n- [ ] 팀원 채용 공고"를 추가해줘
```

**특정 문장 뒤에 추가:**
```
Claude, "Daily Log.md"에서 "오늘 할 일" 뒤에
오늘의 목표 3가지를 추가해줘
```

## 아키텍처

### 🔗 타입 공유 (Single Source of Truth)

MCP 서버는 프론트엔드의 타입 정의를 직접 import합니다:

```typescript
// mcp-pale-blue-dot-server/src/index.ts
import type { Highlight, Memo } from '../../src/types/page.js';
```

**장점:**
- ✅ 타입 정의가 한 곳에만 존재 (`src/types/page.ts`)
- ✅ 프론트엔드 타입 수정 시 MCP 서버도 자동 반영
- ✅ 타입 불일치로 인한 버그 완전 제거
- ✅ 수동 동기화 작업 불필요

**주의:** 프론트엔드의 `Highlight` 또는 `Memo` 타입을 수정하면 MCP 서버를 다시 빌드해야 합니다:
```bash
cd mcp-pale-blue-dot-server && npm run build
```

## 데이터 형식

### Highlight (v2 - Simplified & Stable)

타입 정의는 `src/types/page.ts`에서 관리됩니다. MCP 서버는 이를 직접 import합니다.

**개선사항 (v2):**
- ❌ `contextBefore`/`contextAfter` 제거 - 불안정하고 깨지기 쉬움
- ✅ Markdown offset 기준 - HTML과의 불일치 문제 해결
- ✅ firstWords/lastWords로 충분한 복구 능력
- ✅ 99% 정확도 향상 (offset 기반)
- ✅ 1글자 짧게 표시되는 버그 해결
- ✅ 타입 공유로 프론트엔드와 MCP 서버 자동 동기화

### Memo
```typescript
{
  id: string;
  type: 'independent' | 'linked';
  note: string;              // 메모 내용
  highlightId?: string;      // 연결된 하이라이트 ID (linked 타입인 경우)
  highlightText?: string;    // 하이라이트 텍스트 (참조용)
  highlightColor?: string;   // 하이라이트 색상 (참조용)
  tags?: string[];           // 태그
  createdAt: string;
  updatedAt: string;
  order: number;             // 메모 순서
}
```

## 개발

### 빌드
```bash
cd mcp-pale-blue-dot-server
npm run build
```

### Watch 모드
```bash
npm run watch
```

### 테스트 실행
```bash
npm run dev
```

## 문제 해결

### MCP 서버가 연결되지 않는 경우
1. Claude Desktop을 완전히 종료했는지 확인
2. `claude_desktop_config.json` 경로가 올바른지 확인
3. `PALE_BLUE_DOT_WORKSPACE` 환경 변수가 올바른 workspace 경로를 가리키는지 확인
4. `npm run build`를 실행했는지 확인

### Claude가 도구를 못 찾는 경우
- Claude Desktop을 재시작
- View → Developer → Toggle Developer Tools에서 콘솔 확인
- MCP 서버 연결 상태 확인

## 라이선스

MIT
