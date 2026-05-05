# Plans

> Pale Blue Dot 프로젝트의 단일 진실 공급원 (SSoT).
> 모든 task 는 여기에 등재되어야 자동화 사이클(`/pbd-work`, `/pbd-review`)의 대상이 된다.

## 상태 마커 (반드시 이 4개만 사용)

| 마커 | 의미 | 작성 권한 |
|------|------|-----------|
| `pm:요청` | 사용자가 task 등록 | 사용자 / `pbd-plan` skill |
| `cc:진행` | worker 가 작업 중 (worktree 격리) | `pbd-work` skill (worker-report 수신 후) |
| `cc:완료` | worker 가 자체 검증 통과 | `pbd-work` skill (worker-report 수신 후) |
| `pm:확인` | 사용자가 검수 완료 | 사용자 / `pbd-plan` skill |

전이: `pm:요청 → cc:진행 → cc:완료 → pm:확인`. 역방향 또는 건너뛰기 금지.

## 골든 룰

1. Active Phase 는 **항상 1개**.
2. `cc:*` 마커는 worker agent 가 **직접 못 쓴다**. `pbd-work` 가 worker-report.v1 수신 뒤 갱신.
3. WIP (`cc:진행`) 가 3개 이상이거나 24시간 이상 정체된 task 가 있으면 monitor 가 경고.
4. Plans.md 에 task 가 없으면 worker 는 작업하지 않는다.

---

## Active Phase

### Phase 7: reader-mobile GitHub 연동 설정

**시작**: 2026-05-05
**대상**: `reader-mobile/` (React Native + Expo)

| Task | 내용 | Status |
|------|------|--------|
| T1 | secureConfigService 구현 — DoD: `reader-mobile/services/secureConfigService.ts` 생성, `getRepoUrl()` · `setRepoUrl()` · `getGithubToken()` · `setGithubToken()` · `clearGithubToken()` API 제공, 기본 repoUrl = `https://github.com/SaraHan774/pbd-private`, `expo-secure-store` 사용으로 앱 업데이트 후에도 값 유지, `npx tsc --noEmit` 통과 | cc:완료 |
| T2 | Config 설정 화면 구현 — DoD: `reader-mobile/app/config.tsx` 라우트 생성, 설정 앱 스타일(섹션 그룹) 레이아웃, 레포 URL 입력 필드(기본값 프리필) + GitHub Token 입력 필드(마스킹 + 👁 토글, 저장된 토큰 존재 시 "이미 저장된 토큰이 있습니다 ✓" 표시) + 저장 버튼 + 하단 토스트 피드백("✅ 설정이 저장되었습니다"), 저장 시 `secureConfigService` 호출, `npx tsc --noEmit` 통과 | cc:완료 |
| T3 | 홈 헤더 우상단 ⚙ 진입점 추가 — DoD: `app/index.tsx`(또는 홈 헤더) 우상단에 ⚙ 아이콘 버튼이 있어 `expo-router`로 `/config` 라우트로 이동, 기존 화면 회귀 없음, `npx tsc --noEmit` 통과 | pm:요청 |

---

## 보관 (Archived Phases)

> 완료된 Phase 는 [Plans.archive.md](Plans.archive.md) 에 보관됩니다.
> `/pbd-plan archive` 호출 시 자동으로 이전됩니다.
