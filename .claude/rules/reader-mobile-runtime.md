---
name: reader-mobile-runtime
description: |
  reader-mobile (React Native + Expo) 런타임 정합성 체크리스트.
  비동기 안전성, 네트워크, SecureStore, 네비게이션 UX 패턴을 규정한다.
  worker / reviewer / code-review 스킬이 reader-mobile 파일 변경 시 참조한다.
applies_to:
  - reader-mobile/**
---

# Rule: reader-mobile 런타임 정합성

## When this applies

`reader-mobile/` 하위의 파일을 수정하거나 새로 만들 때 — 특히 비동기 로직,
네트워크 호출, SecureStore 접근, 네비게이션, WebView 가 포함된 변경.

---

## 1. 비동기 안전성 — isMountedRef 패턴

**규칙**: 화면 전환 후 비동기 콜백이 실행되면 setState/Alert 이 unmounted 컴포넌트를
호출해 경고 또는 crash 를 유발한다. async 경계를 가진 모든 화면에 이 패턴을 적용한다.

```tsx
// ✅ 정석 패턴
const isMountedRef = useRef(true);

useFocusEffect(
  useCallback(() => {
    isMountedRef.current = true;
    loadData();
    return () => { isMountedRef.current = false; }; // blur 시 해제
  }, [])
);

useEffect(() => {
  return () => { isMountedRef.current = false; }; // unmount 시 해제
}, []);

async function loadData() {
  const result = await fetchSomething();
  if (!isMountedRef.current) return; // ← 모든 await 뒤에
  setState(result);
}
```

**체크포인트:**
- [ ] `await` 이후 `setState` / `Alert.alert` 호출 전에 `isMountedRef.current` 확인
- [ ] `useFocusEffect` 의 cleanup 에서 `isMountedRef.current = false` 설정
- [ ] `useEffect` unmount cleanup 에서도 동일하게 설정
- [ ] 프로그레스 콜백 내부에서도 `isMountedRef.current` 확인

```tsx
// ❌ [critical] 가드 없이 await 뒤 setState
const result = await syncRepository(url, onProgress);
setSyncing(false); // 화면이 이미 사라졌을 수 있음

// ✅ 가드 후 setState
const result = await syncRepository(url, onProgress);
if (!isMountedRef.current) return;
setSyncing(false);
```

---

## 2. 데이터 로드 — useFocusEffect vs useEffect

**규칙**: 다른 화면에서 돌아왔을 때 데이터를 갱신해야 하면 `useEffect` 단독 사용은
mount 시 1회만 실행되어 stale 데이터를 보여준다.

```tsx
// ❌ [major] mount 시 1회만 로드 → 설정 화면 다녀와도 갱신 안 됨
useEffect(() => { loadCachedData(); }, []);

// ✅ 포커스 복귀마다 재로드
useFocusEffect(
  useCallback(() => { loadCachedData(); }, [])
);
```

**체크포인트:**
- [ ] 다른 화면에서 변경된 데이터를 표시하는 화면은 `useFocusEffect` 로 로드
- [ ] 순수 mount/unmount 이벤트만 필요한 경우(타이머, 구독)는 `useEffect` 유지

---

## 3. 네트워크 — fetchWithTimeout 필수

**규칙**: `githubService.ts` 의 모든 `fetch()` 호출은 반드시 `fetchWithTimeout()` 을 사용한다.
직접 `fetch()` 를 호출하면 네트워크 지연 시 무한 대기 → 앱이 frozen 처럼 보인다.

```typescript
// ❌ [critical] 직접 fetch
const response = await fetch(url, { headers });

// ✅ 타임아웃 적용 (30초)
const response = await fetchWithTimeout(url, { headers });
// 타임아웃 시 '요청 시간이 초과됐습니다 (30초). 네트워크를 확인해주세요.' throw
```

감지 명령:
```bash
grep -n "await fetch(" reader-mobile/services/githubService.ts
# 결과가 있으면 fetchWithTimeout 으로 교체 필요
```

---

## 4. validateRepoUrl — 에러 타입

**규칙**: `validateRepoUrl` 은 `boolean` 을 반환하지 않고 실패 시 `.status` 프로퍼티를
가진 Error 를 throw 한다. 호출자는 status 코드로 사용자 친화적 메시지를 분기한다.

```typescript
// ✅ 호출자 패턴
try {
  await validateRepoUrl(url);
} catch (e: any) {
  const status = e?.status;
  const hint =
    status === 401 || status === 403
      ? '토큰이 없거나 권한이 없습니다.'
      : status === 404
      ? '저장소를 찾을 수 없습니다.'
      : `저장소 연결 실패 (${e.message})`;
  Alert.alert('연결 실패', hint);
  return;
}
```

**체크포인트:**
- [ ] `validateRepoUrl` 반환값을 boolean 으로 처리하는 코드 없음
- [ ] 호출자가 `e.status` 로 401/403/404 를 구분하는가
- [ ] 타임아웃(AbortError → 한국어 메시지)이 사용자에게 표시되는가

---

## 5. SecureStore — 키 통일 및 저장 순서

**규칙**: `tokenService` 와 `secureConfigService` 는 동일한 SecureStore 키
(`github_access_token`)를 사용한다. 두 서비스가 다른 키를 쓰면 저장은 되지만
`githubService` 가 읽지 못하는 silent 버그가 발생한다.

```typescript
// secureConfigService.ts
const GITHUB_TOKEN_KEY = 'github_access_token'; // tokenService 와 동일

// ✅ 저장 성공 후에만 UI 상태 갱신
await setGithubToken(token.trim()); // ← 먼저 저장
setToken('');
setHasExistingToken(true);          // ← 저장 확인 후 상태 업데이트

// ❌ [major] 저장 전 상태 먼저 갱신 → 저장 실패해도 ✓ 표시됨
setHasExistingToken(true);
await setGithubToken(token.trim());
```

**체크포인트:**
- [ ] `secureConfigService` 의 `GITHUB_TOKEN_KEY` 가 `'github_access_token'` 인가
- [ ] `hasExistingToken` 상태가 `setGithubToken` 완료 후에 `true` 로 설정되는가
- [ ] 설정 화면 재진입 시 `useFocusEffect` 로 토큰 존재 여부를 재확인하는가

---

## 6. 동기화 중 내비게이션 차단

**규칙**: 동기화 진행 중 뒤로가기를 허용하면 `isMountedRef` 가드가 있어도
진행 중인 다운로드가 완료되면 화면을 찾지 못하는 상황이 생긴다. 뒤로가기 시
Alert 으로 사용자 의사를 확인한다.

```tsx
// ✅ 동기화 중 뒤로가기 인터셉트
<TouchableOpacity
  onPress={() => {
    if (syncing) {
      Alert.alert(
        '동기화 진행 중',
        '동기화가 완료되지 않았습니다. 지금 나가시겠습니까?',
        [
          { text: '계속 기다리기', style: 'cancel' },
          { text: '나가기', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }}
/>
```

**체크포인트:**
- [ ] 동기화 진행 중 뒤로가기(커스텀 Back 버튼)가 확인 Alert 을 표시하는가
- [ ] `router.back()` 은 Alert `onPress` 콜백 안 또는 `isMountedRef.current` 확인 후 호출하는가
- [ ] 동기화 완료 Alert 의 "확인" 버튼 `onPress` 에서도 `isMountedRef.current` 확인하는가

---

## 7. 로딩/에러/빈 상태 UX

**규칙**: 각 화면은 세 가지 비정상 상태를 모두 표시해야 한다.

| 상태 | 구현 패턴 |
|------|-----------|
| 초기 로딩 | `ActivityIndicator` + 설명 텍스트 |
| 동기화 진행 | 버튼 텍스트 → 진행 단계 문자열, 헤더 `ActivityIndicator` |
| 빈 상태 | 아이콘 + 안내 문구 + 다음 행동 지시 |
| 에러 | `Alert.alert` — 에러 원인(status)에 따라 구체적 안내 |

```tsx
// ✅ 동기화 버튼 텍스트로 진행 상황 표시
<Text>
  {saving ? '저장 중...' : syncing ? syncProgress || '동기화 중...' : '저장 및 동기화'}
</Text>

// ❌ [major] 동기화 중 단순 disabled 만 처리, 진행 상황 없음
<TouchableOpacity disabled={syncing}>
  <Text>저장 및 동기화</Text>
</TouchableOpacity>
```

**체크포인트:**
- [ ] `loading` / `syncing` / `error` / `empty` 네 가지 상태가 렌더 분기를 갖는가
- [ ] 동기화 중 `syncProgress` 가 버튼 또는 헤더에 표시되는가
- [ ] 에러 Alert 이 status 코드별로 구체적인 해결 방법을 안내하는가

---

## 8. WebView 스크롤 복원

**규칙**: `rebuildWebView()` 가 WebView 를 재생성하면 스크롤 위치가 초기화된다.
JS ↔ RN 메시지 브리지로 스크롤 위치를 추적하고 `onLoadEnd` 에서 복원한다.

```tsx
// WebView 내 JS: 스크롤 이벤트 → RN 전송
const SCROLL_TRACKING_JS = `
  let _lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - _lastY) > 50) {
      _lastY = y;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y }));
    }
  }, { passive: true });
  true;
`;

// RN: 스크롤 위치 저장
const scrollYRef = useRef(0);
function handleWebViewMessage(event) {
  try {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.type === 'scroll') scrollYRef.current = msg.y;
  } catch {}
}

// RN: 로드 완료 후 복원
function handleLoadEnd() {
  const y = scrollYRef.current;
  if (y > 0) {
    webViewRef.current?.injectJavaScript(`window.scrollTo(0, ${y}); true;`);
  }
}
```

**체크포인트:**
- [ ] WebView 재생성 이후 스크롤 위치가 복원되는가
- [ ] `postMessage` 페이로드가 throttle 되어 있는가 (과도한 메시지 방지)
- [ ] `injectJavaScript` 마지막에 `true;` 가 있는가 (없으면 경고 발생)

---

## 감지 명령 모음

```bash
# 1. 직접 fetch 호출 (fetchWithTimeout 미사용)
grep -n "await fetch(" reader-mobile/services/githubService.ts

# 2. await 뒤 가드 없는 setState (isMountedRef 누락 가능성)
grep -n "setSyncing\|setColumns\|setLoading\|Alert\.alert" reader-mobile/app/ -r | \
  grep -v "isMountedRef"

# 3. 저장 전 hasExistingToken 상태 갱신
grep -A3 "setHasExistingToken(true)" reader-mobile/app/config.tsx

# 4. validateRepoUrl 반환값 boolean 처리
grep -n "validateRepoUrl" reader-mobile/ -r | grep "=== true\|=== false\|if (await"

# 5. SecureStore 키 불일치
grep -n "GITHUB_TOKEN_KEY\|github_access_token\|pbd_github_token" \
  reader-mobile/services/secureConfigService.ts \
  reader-mobile/services/tokenService.ts
```

---

## 심각도 기준 (reader-mobile)

| 레이블 | 조건 |
|--------|------|
| `[critical]` | 직접 `fetch()` 사용, isMountedRef 없이 async setState, SecureStore 키 불일치 |
| `[major]` | `useEffect` 단독으로 포커스 복귀 데이터 로드, 로딩/에러/빈 상태 중 하나 누락, 동기화 중 뒤로가기 무방비 |
| `[minor]` | 스크롤 복원 누락, syncProgress 미표시, 에러 메시지 비구체적 |
| `[nit]` | 한국어 메시지 어색함, 아이콘 크기/색상 불일치 |
