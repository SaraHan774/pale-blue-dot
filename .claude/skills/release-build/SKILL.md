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
