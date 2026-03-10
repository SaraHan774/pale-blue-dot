# Pale Blue Dot 🌍

A contemplative, local file-based knowledge manager inspired by Carl Sagan's Pale Blue Dot.
Combines kanban workflow with Notion-style pages — serene, minimal, and fully yours.

Carl Sagan의 Pale Blue Dot에서 영감을 받은 로컬 파일 기반 지식 관리자.
칸반 워크플로우 + 노션 스타일 페이지 — 고요하고, 미니멀하며, 온전히 당신의 것입니다.

**PWA (Browser)** | **Desktop (Tauri v2 — macOS, Windows, Linux)**

**PWA (Browser)** | **Desktop (Tauri v2 — macOS, Windows, Linux)**

---

## Features / 주요 기능

### Editor / 에디터
- **Tiptap WYSIWYG 에디터** — 마크다운 기반 리치 텍스트 편집
- **하이라이트 & 메모** — 텍스트 하이라이트 + 연결 메모 (인라인 `<mark>` 태그로 안정적 저장)
- **위키 링크** — `[[페이지 제목]]` 또는 `[[id|표시 텍스트]]`로 페이지 간 연결
- **코드 블록** — highlight.js 기반 구문 강조
- **테이블** — GFM 테이블 지원 (삽입, 편집, 렌더링)
- **Mermaid 다이어그램** — 플로차트, 시퀀스 다이어그램 등 (클릭으로 확대)
- **이미지** — 붙여넣기, 드래그앤드롭, 파일 선택. `workspace/.images/`에 SHA-256 해싱으로 중복 없이 저장
- **체크리스트** — GitHub 스타일 인터랙티브 체크박스
- **슬래시 명령어** — `/` 입력으로 마크다운 스니펫 삽입 (Settings에서 커스터마이즈 가능)
- **페이지 내 검색** — `Cmd/Ctrl+F`
- **목차 패널** — 제목 기반 자동 생성
- **몰입 모드** — 전체화면 집중 편집

### Board / 보드
- **칸반 보드** — 드래그앤드롭으로 카드 이동 및 컬럼 재정렬
- **리스트 뷰** — 정렬 가능한 테이블 형태 (제목, 컬럼, 마감일, 생성일)
- **컴팩트 그리드 뷰** — 모든 컬럼을 한 화면에 그리드로 표시
- **컬럼 색상** — 컬럼별 커스텀 색상 설정
- **보드 밀도** — 일반 / 컴팩트 레이아웃

### Pages / 페이지
- **계층 구조** — `parentId`로 부모-자식 관계 설정, 사이드바에 트리 형태 표시
- **태그 시스템** — 태그 기반 필터링, 컬럼 색상과 연동
- **마감일** — 기한 초과 / 임박 표시
- **페이지 고정 (Pin)** — 중요 페이지를 컬럼 상단에 고정
- **백링크** — 현재 페이지를 참조하는 다른 페이지 확인

### Customization / 설정
- **폰트** — UI 폰트, 모노스페이스 폰트, 크기, 줄 높이
- **제목 색상** — H1~H4 개별 색상 지정
- **다크/라이트 테마**
- **슬래시 명령어 편집** — 명령어 추가, 수정, 삭제
- **데스크톱 줌** — `Cmd+=/Cmd+-/Cmd+0`

### MCP Server / MCP 서버
- **MCP 도구 지원** — AI 에이전트가 페이지 CRUD, 하이라이트, 메모를 직접 조작 가능
- `mcp-pale-blue-dot-server/` — 별도 MCP 서버 패키지 포함

---

## Tech Stack / 기술 스택

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Desktop | Tauri v2 (Rust) |
| State | Zustand |
| Editor | Tiptap + tiptap-markdown |
| Storage | File System Access API (browser) / Tauri FS (desktop) |
| Diagrams | Mermaid |
| Syntax | highlight.js |

---

## Data / 데이터 구조

모든 페이지는 YAML 프론트매터가 포함된 단일 `.md` 파일로 저장됩니다.

```
workspace/
├── .images/           # 이미지 저장소 (SHA-256 해싱)
├── Project A.md       # 루트 페이지
├── Task 1.md          # 하위 페이지 (parentId → Project A)
└── Notes.md           # 루트 페이지
```

```markdown
---
id: "uuid"
title: "페이지 제목"
parentId: "부모-페이지-id"     # 선택
kanbanColumn: "진행 중"        # 선택
tags: ["work", "urgent"]
createdAt: "2026-03-06T10:00Z"
updatedAt: "2026-03-06T15:30Z"
viewType: "document"
memos:
  - id: "memo-uuid"
    type: linked
    note: "메모 내용"
    highlightId: "highlight-uuid"
    highlightText: "하이라이트된 텍스트"
---

페이지 본문. 마크다운 + <mark> 태그로 하이라이트 저장.

[[다른 페이지]] 링크, ![이미지](.images/abc123.png)
```

---

## Getting Started / 시작하기

### Download / 다운로드
[Releases](https://github.com/SaraHan774/pale-blue-dot/releases)에서 플랫폼별 데스크톱 앱 다운로드.

### Web / 웹
https://mykanban-5beb2.web.app

### Development / 개발

```bash
npm install

# 웹 (PWA)
npm run dev          # http://localhost:5173

# 데스크톱 (Tauri)
npm run tauri:dev

# 빌드
npm run build        # 웹
npm run tauri:build  # 데스크톱
```

---

## Keyboard Shortcuts / 단축키

| Shortcut | Action |
|---|---|
| `E` | 편집 모드 진입 |
| `Escape` | 편집 취소 |
| `Cmd/Ctrl+S` | 저장 |
| `Cmd/Ctrl+B/I/E` | 굵게 / 기울임 / 인라인 코드 |
| `Cmd/Ctrl+F` | 페이지 내 검색 |
| `Tab / Shift+Tab` | 들여쓰기 / 내어쓰기 |
| `/` | 슬래시 명령어 |

---

## License

MIT
