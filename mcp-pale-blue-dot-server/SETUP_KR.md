# Pale Blue Dot MCP 서버 설정 가이드

## 🎯 목표

Claude가 Pale Blue Dot 앱의 마크다운 파일을 직접 읽고 하이라이트와 메모를 추가/수정/삭제할 수 있게 합니다.

## 📋 설치 단계

### 1. 의존성 설치 (완료됨 ✅)

```bash
cd /Users/gahee/pale-blue-dot/mcp-pale-blue-dot-server
npm install
npm run build
```

### 2. Claude Desktop 설정 파일 편집

Claude Desktop 설정 파일 경로:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**파일이 없으면 새로 생성하세요.**

#### 기존 설정이 있는 경우:

기존 `mcpServers` 객체에 `pbd` 추가:

```json
{
  "mcpServers": {
    "existing-server": {
      ...
    },
    "pbd": {
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

#### 기존 설정이 없는 경우:

```json
{
  "mcpServers": {
    "pbd": {
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

### 3. Claude Desktop 재시작

1. Claude Desktop을 **완전히 종료** (Cmd+Q)
2. Claude Desktop을 다시 실행
3. 새로운 대화 시작

### 4. 연결 확인

Claude에게 물어보세요:
```
모든 페이지 목록을 보여줘
```

성공하면 workspace 폴더의 모든 마크다운 파일 목록이 표시됩니다!

## 🚀 사용 예시

### 🆕 뉴스 기사 분석 (신규 파일 생성)
```
Claude, 다음 뉴스 기사로 "OpenAI 최신 소식.md" 파일을 만들고,
주요 내용을 노란색으로 하이라이트하고, 각 하이라이트에
한 줄 요약 메모를 남겨줘:

[뉴스 기사 전체 내용 붙여넣기...]
```

**Claude가 자동으로:**
1. ✅ 새 파일 생성
2. ✅ 기사 내용 저장
3. ✅ 중요한 부분 하이라이트 (3-5곳)
4. ✅ 각 하이라이트에 요약 메모 추가
5. ✅ Chrome에서 새로고침하면 바로 확인 가능!

### 페이지 목록 보기
```
Claude, 모든 페이지의 하이라이트와 메모 개수를 보여줘
```

### 특정 페이지 읽기
```
Claude, "Meeting Notes.md" 페이지의 모든 하이라이트와 메모를 읽어줘
```

### 페이지 본문 수정
```
Claude, "회의록.md" 파일의 본문을 다음 내용으로 교체해줘:

# 업데이트된 회의록
...
```

### 페이지 본문에 추가
```
Claude, "TODO.md" 파일 끝에 다음 내용을 추가해줘:

- [ ] 새로운 할 일
```

### 하이라이트 추가
```
Claude, "Project Plan.md" 파일을 읽고, "Q1 목표 달성"이라는 텍스트를 노란색(#FFEB3B)으로 하이라이트해줘
```

### 메모 추가
```
Claude, 방금 추가한 하이라이트에 "3월 말까지 완료 필요"라는 메모를 남겨줘
```

### 모든 메모 요약
```
Claude, "Book Notes.md"의 모든 메모를 읽고 한 페이지로 요약해줘
```

## 🎨 하이라이트 색상 팔레트

```
노란색: #FFEB3B
```

## 🔧 문제 해결

### "도구를 찾을 수 없습니다" 에러

1. Claude Desktop을 완전히 종료했는지 확인 (Cmd+Q)
2. 설정 파일 경로가 정확한지 확인
3. JSON 문법 에러가 없는지 확인 (쉼표, 중괄호 등)

### 설정 파일 확인 명령어

```bash
# 설정 파일 열기
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 설정 파일 편집
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Claude Desktop 로그 확인

Claude Desktop에서:
1. View → Developer → Toggle Developer Tools
2. Console 탭에서 에러 확인

### workspace 경로 확인

```bash
# workspace 폴더가 존재하는지 확인
ls -la /Users/gahee/pale-blue-dot/workspace

# 마크다운 파일 확인
ls /Users/gahee/pale-blue-dot/workspace/*.md
```

## 📝 테스트 페이지 만들기

테스트용 샘플 페이지 생성:

```bash
cat > /Users/gahee/pale-blue-dot/workspace/Test.md << 'EOF'
---
id: test-123
title: Test Page
tags: []
createdAt: '2024-03-01T00:00:00Z'
updatedAt: '2024-03-01T00:00:00Z'
viewType: document
highlights: []
memos: []
---

# Test Page

This is a test page for MCP server.

Important content here that should be highlighted.

Some more text for testing memos.
EOF
```

그런 다음 Claude에게:
```
"Test.md" 파일을 읽고 "Important content here"를 하이라이트해줘
```

## 🎉 완료!

이제 Claude가 Pale Blue Dot 앱의 하이라이트와 메모를 직접 관리할 수 있습니다!

### 다음 단계:

1. ✅ Chrome에서 Pale Blue Dot 앱 열기
2. ✅ Claude에게 페이지 분석 요청
3. ✅ Claude가 중요한 부분에 자동으로 하이라이트 추가
4. ✅ Claude가 하이라이트에 메모 남기기
5. ✅ Pale Blue Dot 앱에서 결과 확인

즐거운 생산성 향상 되세요! 🚀
