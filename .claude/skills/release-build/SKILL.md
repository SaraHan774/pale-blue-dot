---
name: release-build
description: Complete release workflow - validates build, updates version, creates tag, and pushes to trigger deployment
disable-model-invocation: true
---

# Complete Release Workflow

This skill handles the complete release process for both the desktop/web app and the mobile app.

## Usage

| Command | Action |
|---------|--------|
| `/release-build` | Desktop + web release (Tauri + Firebase) |
| `/release-build mobile` | Mobile release — preview APK (EAS Build) |
| `/release-build mobile production` | Mobile release — production AAB (Play Store) |

---

## `/release-build mobile [profile]` — Mobile Release

`profile` 은 `preview` (기본값) 또는 `production`. 생략 시 `preview`.

### Mobile Step 1: Pre-flight Git Checks

```bash
cd /Users/gahee/pale-blue-dot && git status && git log --oneline -3
```

- ✅ main 브랜치인지 확인
- ✅ working tree 가 clean 한지 확인. dirty 하면 변경 파일 목록 보여주고 사용자에게 먼저 커밋할지 물어보기
- ✅ up to date 여부 (unpushed commits 경고는 OK)

### Mobile Step 2: 현재 버전 확인

```bash
cd /Users/gahee/pale-blue-dot && node -e "
const fs = require('fs');
const cfg = require('./reader-mobile/app.config.js');
const e = cfg.expo;
console.log('version    :', e.version);
console.log('versionCode:', e.android.versionCode);
"
```

현재 version / versionCode 출력 후 사용자에게 질문:
"새 버전을 입력하세요 (예: 1.1.0)"

### Mobile Step 3: app.config.js 버전 업데이트

사용자가 NEW_VERSION 을 제공하면:

1. Read tool 로 `reader-mobile/app.config.js` 읽기
2. Edit tool 로 두 필드 수정:
   - `version: 'OLD'` → `version: 'NEW_VERSION'`
   - `versionCode: N` → `versionCode: N+1` (항상 +1)
3. 변경 확인:
```bash
cd /Users/gahee/pale-blue-dot && git diff reader-mobile/app.config.js
```

사용자에게 확인: "version NEW_VERSION, versionCode N+1 로 업데이트됐습니다. 계속할까요?"

**No 라고 하면 중단.**

### Mobile Step 3-b: 릴리즈 노트 생성

버전 업데이트 후, 커밋 범위에서 릴리즈 노트를 자동 생성한다.

1. 이전 mobile 태그 확인:
```bash
cd /Users/gahee/pale-blue-dot && git tag --list 'mobile-v*' | sort -V | tail -1
```

2. 이전 태그부터 HEAD까지 커밋 수집:
```bash
cd /Users/gahee/pale-blue-dot && git log [PREV_TAG]..HEAD --oneline --no-merges
```
(이전 태그가 없으면 전체 히스토리: `git log --oneline --no-merges reader-mobile/`)

3. 아래 **릴리즈 노트 작성 규칙**에 따라 마크다운 노트 작성 후 사용자에게 보여준다.

4. 사용자 확인 후 계속 진행.

### Mobile Step 4: Commit, Tag, Push

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

### Mobile Step 5: 완료 메시지

profile 이 `preview` 인 경우:
```
✅ mobile-v[NEW_VERSION] released! (preview APK)

빌드 환경: PBD Reader (Preview) — com.palebluedot.reader.preview
versionCode: [N+1]

📱 GitHub Actions:
   https://github.com/SaraHan774/pale-blue-dot/actions

📦 APK 다운로드 (빌드 완료 후):
   https://expo.dev/accounts/vertias-lux-mea/projects/pale-blue-dot-reader/builds
```

profile 이 `production` 인 경우:
```
✅ mobile-v[NEW_VERSION] released! (production AAB)

빌드 환경: Pale Blue Dot Reader — com.palebluedot.reader
versionCode: [N+1]

⚠️  production 빌드는 태그 트리거로 자동 실행되지 않습니다.
    GitHub Actions → EAS Build → Run workflow → profile: production 으로 수동 실행하거나
    아래 명령으로 로컬에서 실행하세요:
    cd reader-mobile && eas build --platform android --profile production --non-interactive

📦 AAB 다운로드 (빌드 완료 후):
   https://expo.dev/accounts/vertias-lux-mea/projects/pale-blue-dot-reader/builds
```

---

## 빌드 환경 참고 (mobile)

| profile | APP_ENV | 앱 이름 | 패키지명 | 산출물 |
|---------|---------|---------|---------|--------|
| development | development | PBD Reader (Dev) | ...reader.dev | APK (debug) |
| preview | preview | PBD Reader (Preview) | ...reader.preview | APK |
| production | production | Pale Blue Dot Reader | ...reader | AAB |

- `preview` / `development` 는 기기에 동시 설치 가능 (패키지명 다름)
- `constants/env.ts` 의 `IS_PRODUCTION`, `IS_PREVIEW`, `IS_DEVELOPMENT` 플래그로 앱 내 분기 가능

---

## `/release-build` — Desktop + Web Release

### Workflow Overview

1. **Pre-flight checks**: Verify git status and branch
2. **Build validation**: Run `npm run build` and check for errors
3. **Version update**: Update version files
4. **Git operations**: Commit, tag, and push
5. **Deployment reminder**: Check GitHub Secrets for Firebase

### Step 1: Pre-flight Git Checks

```bash
cd /Users/gahee/pale-blue-dot && git status
```

**Check for:**
- ✅ On branch `main` (if not, warn and ask to switch)
- ✅ Working tree clean OR show uncommitted changes
- ✅ Up to date with origin (no unpushed commits warning is OK)

```bash
cd /Users/gahee/pale-blue-dot && git log --oneline -3
```

Show recent commits for context.

**If working tree has uncommitted changes:**
- List the changed files
- Ask user if they want to commit them first or proceed anyway
- If user wants to commit, pause and let them describe changes
- **DO NOT proceed with release until user confirms**

### Step 2: Build Validation

```bash
cd /Users/gahee/pale-blue-dot && npm run build
```

**Wait for completion** and check the exit code.

**If build FAILS** (exit code ≠ 0):
- **STOP immediately** - do NOT proceed with ANY further steps
- Show the complete error output
- Identify the specific error:
  - TypeScript errors: `error TS####:` - show file:line and description
  - Vite build errors: Module not found, import errors
  - Type mismatches, missing properties
- Point to the file and line number if available
- Suggest fixes if the error is clear
- **DO NOT run any git commands**
- Tell user to fix errors and run `/release-build` again

**If build SUCCEEDS** (exit code = 0):
- Show: "✅ Build validation passed"
- Show build output summary (chunk sizes, warnings if any)
- Continue to Step 3

### Step 2-b: 릴리즈 노트 생성

빌드 검증 통과 후, 커밋 범위에서 릴리즈 노트를 자동 생성한다.

1. 이전 데스크톱 태그 확인:
```bash
cd /Users/gahee/pale-blue-dot && git tag --list 'v[0-9]*' | grep -v 'mobile' | sort -V | tail -1
```

2. 이전 태그부터 HEAD까지 커밋 수집:
```bash
cd /Users/gahee/pale-blue-dot && git log [PREV_TAG]..HEAD --oneline --no-merges
```

3. 아래 **릴리즈 노트 작성 규칙**에 따라 마크다운 노트 작성 후 사용자에게 보여준다.

4. 사용자가 수정을 원하면 반영 후 계속. 아니면 바로 Step 3으로.

### Step 3: Version Update

Ask the user: "What version number for this release? (e.g., 0.5.3)"

**After user provides version:**

1. Read current versions:
```bash
cd /Users/gahee/pale-blue-dot && cat package.json | grep '"version"' && cat src-tauri/Cargo.toml | grep '^version' && cat src-tauri/tauri.conf.json | grep '"version"'
```

2. Update **all three** version files with new version using Edit tool:
   - `package.json`: `"version": "X.Y.Z"` → `"version": "[VERSION]"`
   - `src-tauri/Cargo.toml`: `version = "X.Y.Z"` → `version = "[VERSION]"`
   - `src-tauri/tauri.conf.json`: `"version": "X.Y.Z"` → `"version": "[VERSION]"`

3. Confirm the changes:
```bash
cd /Users/gahee/pale-blue-dot && git diff package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
```

Show the diff to user and ask: "Version updated to [VERSION]. Proceed with commit and tag?"

**If user says no:** Stop here and exit
**If user says yes:** Continue to Step 4

### Step 4: Git Commit and Tag

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

### Step 5: Push to Trigger Release

Ask user: "Ready to push? This will trigger GitHub Actions (Tauri build + Firebase deployment)."

**If YES:**
```bash
cd /Users/gahee/pale-blue-dot && git push && git push origin v[VERSION]
```

**If NO:**
- "로컬에 커밋·태그만 된 상태입니다. 나중에 push 하려면:"
- `git push && git push origin v[VERSION]`
- Exit

### Step 6: Deployment Checklist

```
✅ Release v[VERSION] triggered!

📋 Deployment Checklist:

1. GitHub Actions 모니터:
   https://github.com/SaraHan774/pale-blue-dot/actions

2. 필요한 GitHub Secrets:
   https://github.com/SaraHan774/pale-blue-dot/settings/secrets/actions
   - VITE_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID / MEASUREMENT_ID
   - FIREBASE_SERVICE_ACCOUNT

3. 예상 워크플로우:
   ✓ GitHub Release draft 생성
   ✓ Tauri 앱 빌드 (macOS Intel + ARM)
   ✓ Web 앱 빌드 & Firebase 배포
   ✓ GitHub Release 퍼블리시

4. 배포 후 확인:
   - Desktop: https://github.com/SaraHan774/pale-blue-dot/releases
   - Web:     https://mykanban-5beb2.web.app
```

---

---

## 릴리즈 노트 작성 규칙

### 커밋 분류 기준

수집된 커밋을 conventional commit prefix 기준으로 분류한다:

| prefix | 섹션 | 표시 여부 |
|--------|------|-----------|
| `feat` / `feat(...)` | ✨ 새 기능 | 항상 표시 |
| `fix` / `fix(...)` | 🐛 버그 수정 | 항상 표시 |
| `refactor` | 🔧 개선 | 표시 |
| `perf` | ⚡ 성능 | 표시 |
| `ci` / `build` | 🏗 빌드/배포 | 표시 |
| `chore` | — | **숨김** (버전 범프, Plans.md 마커 등 내부 작업) |
| `docs` | 📝 문서 | 표시 |
| `test` | 🧪 테스트 | 숨김 (사용자 무관) |

**숨김 규칙 예외**: `chore` 라도 사용자에게 의미 있는 내용이면 표시한다.
(예: `chore: EAS Build 파이프라인 추가` → 표시 / `chore: T3 cc:완료 마커 갱신` → 숨김)

### 노트 포맷

```markdown
## 🚀 What's New in v[VERSION]

### ✨ 새 기능
- 기능 요약 (커밋 메시지를 사용자 언어로 풀어서 작성)

### 🐛 버그 수정
- 수정 내용 요약

### 🔧 개선
- 개선 내용 요약

### 🏗 빌드/배포
- 배포 관련 변경사항

---
**Full Changelog**: https://github.com/SaraHan774/pale-blue-dot/compare/[PREV_TAG]...v[VERSION]
```

### 작성 지침

1. **커밋 메시지를 그대로 복사하지 말 것** — 사용자가 읽기 좋게 한국어로 풀어서 작성
2. **scope 제거** — `feat(reader-mobile): ...` → `...` (괄호 부분 삭제)
3. **중복 커밋 합치기** — 같은 기능의 `feat(T2):` + `feat: Phase 6 T2 머지` 같은 쌍은 하나로 합침
4. **섹션이 비어있으면 생략** — 해당 릴리즈에 fix 가 없으면 `### 🐛 버그 수정` 섹션 통째로 제거
5. **mobile 릴리즈**는 `reader-mobile/` 관련 커밋만 포함
6. **desktop 릴리즈**는 `reader-mobile/` 관련 커밋 제외 (모바일 전용 변경은 별도 릴리즈)

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
## 🚀 What's New in mobile-v1.1.0

### ✨ 새 기능
- 하이라이트 탭 시 메모를 바로 확인하고 추가할 수 있는 메모 바텀 시트 추가

### 🔧 개선
- 하이라이트 색상 선택·메모·삭제를 하나의 바텀 시트로 통합 (2-depth → 1-depth)

---
**Full Changelog**: https://github.com/SaraHan774/pale-blue-dot/compare/mobile-v1.0.0...mobile-v1.1.0
```

---

## Key Rules

- **Always use absolute paths**: `/Users/gahee/pale-blue-dot`
- **Stop on build errors**: Never proceed past failed builds
- **Ask before pushing**: Confirm before any push
- **Exit code matters**: Only exit code 0 means success
- **Version format**: Semantic versioning (X.Y.Z)
- **mobile versionCode**: 항상 +1, 절대 낮아지면 안 됨

## Emergency Rollback

```bash
# 태그 삭제
git push origin :refs/tags/v[VERSION]   # 또는 :refs/tags/mobile-v[VERSION]
git tag -d v[VERSION]

# 버전 범프 커밋 되돌리기
git revert HEAD
git push
```

## Success Criteria — Desktop
- ✅ main 브랜치, working tree clean
- ✅ `npm run build` exit code 0
- ✅ package.json, Cargo.toml, tauri.conf.json 버전 업데이트
- ✅ tag `v[VERSION]` 생성 및 push

## Success Criteria — Mobile
- ✅ main 브랜치, working tree clean
- ✅ `reader-mobile/app.config.js` version + versionCode 업데이트
- ✅ tag `mobile-v[VERSION]` 생성 및 push
- ✅ EAS Build 트리거 (preview) 또는 수동 실행 안내 (production)
