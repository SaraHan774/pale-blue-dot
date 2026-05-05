---
name: release-build
description: Complete release workflow - validates build, updates version, creates tag, and pushes to trigger deployment
disable-model-invocation: true
---

# Complete Release Workflow

데스크톱/웹 앱과 모바일 앱의 릴리즈 전 과정을 처리한다.

## 사용법

| 명령 | 동작 |
|------|------|
| `/release-build` | 데스크톱 + 웹 릴리즈 (Tauri + Firebase) |
| `/release-build mobile` | 모바일 릴리즈 — preview APK (EAS Build) |
| `/release-build mobile production` | 모바일 릴리즈 — production AAB (Play Store) |

---

## `/release-build mobile [profile]` — 모바일 릴리즈

`profile` 기본값은 `preview`. 명시하지 않으면 preview APK 빌드.

### Step 1: 사전 점검

```bash
cd /Users/gahee/pale-blue-dot && git status && git log --oneline -3
```

- main 브랜치인지 확인한다.
- working tree 가 dirty 하면 변경 파일 목록을 보여주고 커밋 여부를 확인한다.
- 커밋이 완료되기 전까지 진행하지 않는다.

### Step 2: 현재 버전 확인

```bash
cd /Users/gahee/pale-blue-dot && node -e "
const cfg = require('./reader-mobile/app.config.js');
const e = cfg.expo;
console.log('version    :', e.version);
console.log('versionCode:', e.android.versionCode);
"
```

현재 version / versionCode 를 출력한 뒤 사용자에게 신규 버전을 확인한다.

### Step 2-b: 릴리즈 노트 생성

1. 이전 mobile 태그 확인:
```bash
cd /Users/gahee/pale-blue-dot && git tag --list 'mobile-v*' | sort -V | tail -1
```

2. 이전 태그부터 HEAD 까지 커밋 수집:
```bash
cd /Users/gahee/pale-blue-dot && git log [PREV_TAG]..HEAD --oneline --no-merges
```
이전 태그가 없으면: `git log --oneline --no-merges -- reader-mobile/`

3. 아래 **릴리즈 노트 작성 규칙**에 따라 노트 초안 작성 후 사용자에게 제시한다.
4. 수정 요청이 있으면 반영 후 확정한다.

### Step 3: app.config.js 버전 업데이트

1. Read tool 로 `reader-mobile/app.config.js` 읽기
2. Edit tool 로 두 필드 수정:
   - `version: 'OLD'` → `version: 'NEW_VERSION'`
   - `versionCode: N` → `versionCode: N+1` (항상 +1)
3. 변경 확인:
```bash
cd /Users/gahee/pale-blue-dot && git diff reader-mobile/app.config.js
```
"version NEW_VERSION, versionCode N+1 로 업데이트됐습니다. 진행하시겠습니까?"
거절 시 중단한다.

### Step 4: Commit, Tag, Push

```bash
cd /Users/gahee/pale-blue-dot && git add reader-mobile/app.config.js
```

```bash
cd /Users/gahee/pale-blue-dot && git commit -m "chore(mobile): bump version to [NEW_VERSION] (versionCode [N+1])

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

```bash
cd /Users/gahee/pale-blue-dot && git tag mobile-v[NEW_VERSION]
```

```bash
cd /Users/gahee/pale-blue-dot && git push && git push origin mobile-v[NEW_VERSION]
```

### Step 5: 완료 보고

profile 이 `preview` 인 경우:
```
mobile-v[NEW_VERSION] (preview APK) 배포가 시작됐습니다.

빌드 환경  : PBD Reader (Preview) — com.palebluedot.reader.preview
versionCode: [N+1]

빌드 진행 상황:
https://github.com/SaraHan774/pale-blue-dot/actions

APK 다운로드 (빌드 완료 후):
https://expo.dev/accounts/vertias-lux-mea/projects/pale-blue-dot-reader/builds
```

profile 이 `production` 인 경우:
```
mobile-v[NEW_VERSION] (production AAB) 버전 태그가 생성됐습니다.

빌드 환경  : Pale Blue Dot Reader — com.palebluedot.reader
versionCode: [N+1]

주의: production 빌드는 태그 트리거로 자동 실행되지 않습니다.
아래 두 가지 방법 중 하나로 실행하십시오.

방법 1 — GitHub Actions 수동 실행:
https://github.com/SaraHan774/pale-blue-dot/actions
→ EAS Build → Run workflow → profile: production

방법 2 — 로컬 실행:
cd reader-mobile && eas build --platform android --profile production --non-interactive

AAB 다운로드 (빌드 완료 후):
https://expo.dev/accounts/vertias-lux-mea/projects/pale-blue-dot-reader/builds
```

---

## 빌드 환경 참고 (mobile)

| profile | APP_ENV | 앱 이름 | 패키지명 | 산출물 |
|---------|---------|---------|---------|--------|
| development | development | PBD Reader (Dev) | ...reader.dev | APK (debug) |
| preview | preview | PBD Reader (Preview) | ...reader.preview | APK |
| production | production | Pale Blue Dot Reader | ...reader | AAB |

- preview / development 는 패키지명이 달라 기기에 동시 설치 가능하다.
- `constants/env.ts` 의 `IS_PRODUCTION`, `IS_PREVIEW`, `IS_DEVELOPMENT` 플래그로 앱 내 환경 분기가 가능하다.

---

## `/release-build` — 데스크톱 + 웹 릴리즈

### Step 1: 사전 점검

```bash
cd /Users/gahee/pale-blue-dot && git status
```

- main 브랜치인지 확인한다.
- working tree 가 dirty 하면 변경 파일 목록을 보여주고 커밋 여부를 확인한다.
- 커밋이 완료되기 전까지 진행하지 않는다.

```bash
cd /Users/gahee/pale-blue-dot && git log --oneline -3
```

### Step 2: 빌드 검증

```bash
cd /Users/gahee/pale-blue-dot && npm run build
```

빌드 실패 시 (exit code != 0):
- 즉시 중단한다. 이후 단계를 진행하지 않는다.
- 에러 전체를 출력하고 파일·라인 정보와 함께 원인을 설명한다.
- git 명령을 실행하지 않는다.
- 수정 후 `/release-build` 재실행을 안내한다.

빌드 성공 시:
- "빌드 검증 완료." 를 출력한다.
- 청크 크기 요약을 보여준다.

### Step 2-b: 릴리즈 노트 생성

1. 이전 데스크톱 태그 확인:
```bash
cd /Users/gahee/pale-blue-dot && git tag --list 'v[0-9]*' | grep -v 'mobile' | sort -V | tail -1
```

2. 이전 태그부터 HEAD 까지 커밋 수집:
```bash
cd /Users/gahee/pale-blue-dot && git log [PREV_TAG]..HEAD --oneline --no-merges
```

3. 아래 **릴리즈 노트 작성 규칙**에 따라 노트 초안 작성 후 사용자에게 제시한다.
4. 수정 요청이 있으면 반영 후 확정한다.

### Step 3: 버전 업데이트

"이번 릴리즈 버전을 입력하십시오. (예: 0.5.3)"

버전 확인:
```bash
cd /Users/gahee/pale-blue-dot && cat package.json | grep '"version"' && cat src-tauri/Cargo.toml | grep '^version' && cat src-tauri/tauri.conf.json | grep '"version"'
```

Edit tool 로 세 파일 일괄 업데이트:
- `package.json`: `"version": "X.Y.Z"` → `"version": "[VERSION]"`
- `src-tauri/Cargo.toml`: `version = "X.Y.Z"` → `version = "[VERSION]"`
- `src-tauri/tauri.conf.json`: `"version": "X.Y.Z"` → `"version": "[VERSION]"`

변경 확인:
```bash
cd /Users/gahee/pale-blue-dot && git diff package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
```

"[VERSION] 으로 업데이트됐습니다. 커밋 및 태그를 생성하시겠습니까?"
거절 시 중단한다.

### Step 4: Commit, Tag

```bash
cd /Users/gahee/pale-blue-dot && git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
```

```bash
cd /Users/gahee/pale-blue-dot && git commit -m "chore: bump version to [VERSION]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

```bash
cd /Users/gahee/pale-blue-dot && git tag v[VERSION] && git log --oneline -1
```

### Step 5: Push

"push 하시겠습니까? GitHub Actions 가 트리거됩니다 (Tauri 빌드 + Firebase 배포)."

승인 시:
```bash
cd /Users/gahee/pale-blue-dot && git push && git push origin v[VERSION]
```

거절 시:
- "로컬에 커밋과 태그만 생성된 상태입니다. 준비되면 아래 명령으로 배포하십시오."
- `git push && git push origin v[VERSION]`

### Step 6: 완료 보고

```
v[VERSION] 배포가 시작됐습니다.

빌드 진행 상황:
https://github.com/SaraHan774/pale-blue-dot/actions

필요한 GitHub Secrets (미설정 시 Firebase 배포 실패):
https://github.com/SaraHan774/pale-blue-dot/settings/secrets/actions
  VITE_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID / MEASUREMENT_ID
  FIREBASE_SERVICE_ACCOUNT

예상 실행 순서:
  1. GitHub Release draft 생성
  2. Tauri 앱 빌드 (macOS Intel + ARM)
  3. Web 앱 빌드 및 Firebase 배포
  4. GitHub Release 퍼블리시

배포 완료 후:
  데스크톱 앱: https://github.com/SaraHan774/pale-blue-dot/releases
  웹 앱:       https://mykanban-5beb2.web.app
```

---

## 릴리즈 노트 작성 규칙

### 커밋 분류 기준

| prefix | 섹션 | 표시 |
|--------|------|------|
| `feat` | 새 기능 | 항상 |
| `fix` | 버그 수정 | 항상 |
| `refactor` | 개선 | 표시 |
| `perf` | 성능 개선 | 표시 |
| `ci` / `build` | 빌드/배포 | 표시 |
| `docs` | 문서 | 표시 |
| `chore` | — | 기본 숨김 |
| `test` | — | 숨김 |

`chore` 예외: 사용자에게 의미 있는 내용은 표시한다.
- 표시: `chore: EAS Build 파이프라인 추가`
- 숨김: `chore: T3 cc:완료 마커 갱신`, `chore: bump version to ...`

### 노트 포맷

```markdown
## v[VERSION] — YYYY-MM-DD

### 새 기능
- 기능 요약

### 버그 수정
- 수정 내용 요약

### 개선
- 개선 내용 요약

### 빌드/배포
- 배포 관련 변경사항

---
Full Changelog: https://github.com/SaraHan774/pale-blue-dot/compare/[PREV_TAG]...v[VERSION]
```

### 작성 지침

1. 커밋 메시지를 그대로 복사하지 않는다. 사용자가 읽기 좋은 한국어로 풀어 쓴다.
2. scope 괄호를 제거한다. `feat(reader-mobile): ...` → `...`
3. 같은 기능에 대한 커밋 쌍(feat + 머지 커밋)은 하나로 합친다.
4. 내용이 없는 섹션은 통째로 제거한다.
5. mobile 릴리즈는 `reader-mobile/` 관련 커밋만 포함한다.
6. desktop 릴리즈는 `reader-mobile/` 관련 커밋을 제외한다.

### 예시

커밋 목록:
```
feat(T4): reader-mobile 메모 바텀 시트 구현
feat: Phase 6 T4 reader-mobile 메모 바텀 시트 머지
refactor(reader-mobile): HighlightSheet 통합 및 UX 개선
chore: T4 cc:완료 마커 갱신
chore: bump version to 0.9.3
```

생성 결과:
```markdown
## mobile-v1.1.0 — 2026-05-05

### 새 기능
- 하이라이트 탭 시 메모를 바로 확인하고 추가할 수 있는 메모 패널 추가

### 개선
- 하이라이트 색상 선택, 메모, 삭제를 단일 패널에서 처리 (기존 2단계 → 1단계)

---
Full Changelog: https://github.com/SaraHan774/pale-blue-dot/compare/mobile-v1.0.0...mobile-v1.1.0
```

---

## 핵심 규칙

- 절대 경로를 사용한다: `/Users/gahee/pale-blue-dot`
- 빌드 실패 시 즉시 중단하며 이후 단계를 진행하지 않는다.
- push 전 반드시 사용자 확인을 받는다.
- exit code 0 만 성공으로 간주한다.
- 버전은 Semantic Versioning (X.Y.Z) 형식을 따른다.
- mobile versionCode 는 항상 +1 이며 절대 감소시키지 않는다.

## 긴급 롤백

```bash
# 태그 삭제
git push origin :refs/tags/v[VERSION]   # 또는 :refs/tags/mobile-v[VERSION]
git tag -d v[VERSION]

# 버전 범프 커밋 되돌리기
git revert HEAD
git push
```

## 완료 기준 — 데스크톱

- main 브랜치, working tree clean
- `npm run build` exit code 0
- package.json, Cargo.toml, tauri.conf.json 버전 업데이트
- tag `v[VERSION]` 생성 및 push

## 완료 기준 — 모바일

- main 브랜치, working tree clean
- `reader-mobile/app.config.js` version + versionCode 업데이트
- tag `mobile-v[VERSION]` 생성 및 push
- EAS Build 트리거 완료 (preview) 또는 수동 실행 안내 (production)
