---
name: pbd-ops
description: Plan/Work/Review phase 별 출력 포맷 강제 (pale-blue-dot harness)
keep-coding-instructions: true
---

# Pale Blue Dot Ops Output Style

이 output style 이 활성화되면 모든 응답은 아래 규칙을 따른다.

## Phase 인식

현재 호출이 어떤 phase 인지 자동 추론:

- `/pbd-plan` → **Plan phase**
- `/pbd-work` → **Work phase**
- `/pbd-review` → **Review phase**
- `/release-build` → **Release phase**
- 그 외 일반 대화 → **Free phase** (이 규칙은 Free phase 에는 적용되지 않음)

## Work phase 응답 규칙

응답 끝에 항상 다음 3-section 을 추가한다 (각 1-2줄):

```
**Done**: 이번 턴에 끝낸 것
**Current**: 지금 진행 중 (다음 도구 호출에서 다룰 대상)
**Next**: 다음 턴 또는 다음 사이클에서 처리할 것
```

3-section 이 비어 있으면 빈 채로 두지 말고 `(없음)` 으로 명시.

## Review phase 응답 규칙

reviewer agent 의 verdict 를 받으면 다음 형식으로 사용자에게 전달:

```
**Verdict**: APPROVE | REQUEST_CHANGES | COMMENT
**Findings**: (critical/major/minor 별로 분류한 bullet 목록)
**Next action**: (사용자가 해야 할 것)
```

## React 컴포넌트 변경 시

`src/components/**` 또는 `src/pages/**` 의 파일을 수정한 경우:

- 영향 받는 파일 경로를 file:line 마크다운 링크로 명시
- 같은 컴포넌트를 import 하는 파일이 있으면 해당 파일 목록도 명시 (grep 으로 확인)

## Service layer 변경 시

`src/services/**` 의 파일을 수정한 경우:

- 호출자 목록 (grep -r "from.*<service-name>" src/ 결과 요약)
- 특히 `pageService` 의 경우 `updatePageMetadata` vs `updatePage` 선택 사유 명시

## MCP 타입 변경 시

`src/types/page.ts` 의 `Highlight` 또는 `Memo` 타입을 수정한 경우, **응답 끝에 반드시 다음 경고 출력**:

```
⚠️ MCP 서버 rebuild 필요:
cd mcp-pale-blue-dot-server && npm run build
```

이 경고가 빠지면 worker self_review 의 ③ 항목에서 fail.

## Performance 패턴 위반 감지 시

다음 안티패턴이 발견되면 응답 본문에 ⚠️ 로 강조:

- `pages.find(...)` 직접 호출 → `usePageById(id)` 권장
- `pages.filter(p => p.column === ...)` → `usePagesByColumn(col)` 권장
- 메타데이터만 바꾸는데 `updatePage()` 호출 → `updatePageMetadata()` 권장

## 응답 톤

- 작업 결과는 **결정 / 사실** 위주로 짧게.
- "내가 이걸 했다" 가 아니라 "이렇게 됐다" 로 서술.
- 완료한 코드 변경을 본문에서 다시 설명하지 않음. diff 가 사용자에게 보임.
