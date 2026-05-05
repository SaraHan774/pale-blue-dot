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

## 9. 터치 타깃 — 최소 44pt 보장

**규칙**: 아이콘 버튼처럼 시각적 크기가 작은 요소는 `hitSlop` 으로 터치 영역을 확장한다.
44×44pt 미만이면 오터치·미스터치가 잦아진다 (Apple HIG / Material 기준 동일).

```tsx
// ❌ [major] 아이콘만 있는 버튼에 hitSlop 없음
<TouchableOpacity onPress={handleSync}>
  <Ionicons name="refresh-outline" size={22} />
</TouchableOpacity>

// ✅ hitSlop 으로 44pt 확보
<TouchableOpacity
  onPress={handleSync}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  accessibilityLabel="동기화"
>
  <Ionicons name="refresh-outline" size={22} />
</TouchableOpacity>
```

**체크포인트:**
- [ ] 아이콘 전용 버튼(`size` ≤ 24)에 `hitSlop` 이 있는가
- [ ] `hitSlop` 값이 `(44 - iconSize) / 2` 이상인가

---

## 10. 접근성 — 아이콘 버튼 레이블

**규칙**: 텍스트 없이 아이콘만 있는 버튼은 스크린 리더가 내용을 알 수 없다.
`accessibilityLabel` 을 반드시 붙인다.

```tsx
// ❌ [major] 아이콘만, 레이블 없음
<TouchableOpacity onPress={() => router.push('/config')}>
  <Ionicons name="settings-outline" size={22} />
</TouchableOpacity>

// ✅ 레이블 + role 명시
<TouchableOpacity
  onPress={() => router.push('/config')}
  accessibilityLabel="설정"
  accessibilityRole="button"
>
  <Ionicons name="settings-outline" size={22} />
</TouchableOpacity>
```

`accessibilityHint` 는 동작 결과가 레이블만으로 불분명할 때 추가한다 (예: "설정 화면으로 이동").

**체크포인트:**
- [ ] 텍스트 없는 터치 요소에 `accessibilityLabel` 이 있는가
- [ ] 목록 아이템 등 역할이 명확한 경우 `accessibilityRole` 이 있는가

---

## 11. 키보드 처리 — KeyboardAvoidingView + 외부 탭 해제

**규칙**: 텍스트 입력이 있는 화면은 키보드가 올라왔을 때 입력 필드가 가려지지 않도록
`KeyboardAvoidingView` 로 감싼다. iOS 와 Android 의 동작 방식이 다르다.

```tsx
// ✅ 플랫폼별 behavior 분기
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    {/* 입력 필드 */}
  </ScrollView>
</KeyboardAvoidingView>
```

- `behavior="padding"` (iOS): 키보드만큼 하단에 패딩 추가
- `behavior={undefined}` (Android): 시스템이 자동 처리 (`android:windowSoftInputMode`)
- `keyboardShouldPersistTaps="handled"` : ScrollView 내 버튼 탭 시 키보드 유지

```tsx
// ✅ 입력 완료 후 다음 필드로 포커스 이동 (returnKeyType)
<TextInput
  returnKeyType="next"
  onSubmitEditing={() => tokenInputRef.current?.focus()}
/>
<TextInput
  ref={tokenInputRef}
  returnKeyType="done"
  onSubmitEditing={Keyboard.dismiss}
/>
```

**체크포인트:**
- [ ] 입력 필드가 있는 화면에 `KeyboardAvoidingView` 가 있는가
- [ ] iOS/Android `behavior` 가 플랫폼별로 분기되는가
- [ ] `returnKeyType` 이 흐름에 맞게 설정되어 있는가 (`next` → `done`)

---

## 12. Safe Area — 하드코딩 padding 금지

**규칙**: 노치·Dynamic Island·홈 인디케이터 영역은 기기마다 크기가 다르다.
`useSafeAreaInsets()` 를 사용하고 상수값으로 패딩을 하드코딩하지 않는다.

```tsx
// ❌ [major] 하드코딩 패딩 — 다른 기기에서 노치에 가림
<View style={{ paddingTop: 44, paddingBottom: 34 }}>

// ✅ 런타임 insets 사용
const insets = useSafeAreaInsets();
<View style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
```

`SafeAreaProvider` 가 앱 루트(`_layout.tsx`)에 한 번만 설정되어 있으면 하위 화면은
`useSafeAreaInsets()` 만 사용한다.

**체크포인트:**
- [ ] 상단/하단 패딩에 상수 `44` / `34` / `20` 이 하드코딩되어 있지 않은가
- [ ] `useSafeAreaInsets()` 로 `insets.top` / `insets.bottom` 을 반영하는가

---

## 13. 리스트 — FlatList keyExtractor + 가상화

**규칙**: `FlatList` 의 `keyExtractor` 는 안정적인 ID 를 반환해야 한다.
배열 index 를 key 로 쓰면 항목 추가/삭제 시 불필요한 리렌더 또는 UI 깜빡임이 생긴다.

```tsx
// ❌ [major] index 를 key 로 사용
<FlatList
  keyExtractor={(_, index) => String(index)}
  ...
/>

// ✅ 고유 ID 사용
<FlatList
  keyExtractor={(item) => item.id}
  ...
/>
```

항목이 100개 이상이 될 수 있는 리스트는 `FlatList` / `FlashList` 를 사용한다.
`ScrollView` 안에 `map()` 으로 렌더하면 전체 항목을 한 번에 마운트한다.

```tsx
// ❌ [minor] 긴 리스트를 ScrollView + map 으로 렌더
<ScrollView>
  {columns.map(col => <ColumnCard key={col} />)} // 100개 이상이면 성능 문제
</ScrollView>

// ✅ FlatList 로 가상화
<FlatList
  data={columns}
  keyExtractor={(item) => item}
  renderItem={({ item }) => <ColumnCard name={item} />}
/>
```

**체크포인트:**
- [ ] `keyExtractor` 가 배열 index 가 아닌 고유 값을 반환하는가
- [ ] 동적으로 길어질 수 있는 리스트에 `FlatList` 를 사용하는가

---

## 14. Animated — useNativeDriver 필수

**규칙**: `Animated.timing` / `Animated.spring` 은 `useNativeDriver: true` 를 설정해야
JS 스레드를 차단하지 않는다. `transform` / `opacity` 프로퍼티는 네이티브 드라이버를 지원한다.

```tsx
// ❌ [major] useNativeDriver 누락 또는 false
Animated.timing(opacity, {
  toValue: 1,
  duration: 200,
}).start();

// ✅ 네이티브 드라이버 활성화
Animated.timing(opacity, {
  toValue: 1,
  duration: 200,
  useNativeDriver: true, // opacity, transform 에서 필수
}).start();
```

`useNativeDriver: true` 를 쓸 수 없는 경우 (예: `height`, `width`, `backgroundColor` 애니메이션):
- `LayoutAnimation` 으로 대체하거나
- `useNativeDriver: false` 를 명시적으로 적고 `[nit]` 수준 주석으로 이유를 남긴다.

**체크포인트:**
- [ ] `Animated.timing` / `Animated.spring` 에 `useNativeDriver` 가 명시되어 있는가
- [ ] `opacity` / `transform` 애니메이션에서 `useNativeDriver: true` 인가

---

## 15. Alert 중복 방지

**규칙**: `Alert.alert` 는 OS 레벨 모달이라 스택이 쌓이면 사용자가 닫을 수 없는
상태가 된다. 비동기 연쇄 호출이나 재진입에서 이중 Alert 이 발생하지 않도록 한다.

```tsx
// ❌ [major] 동기화 실패 + 뒤로가기 Alert 이 겹칠 수 있음
async function startSync() {
  try { ... }
  catch { Alert.alert('오류', ...); }      // ← 첫 번째 Alert
  finally { setSyncing(false); }
}

// 동시에 사용자가 Back 버튼 → 두 번째 Alert 발생

// ✅ isMountedRef + syncing 상태로 이중 발화 차단
catch (error) {
  if (!isMountedRef.current) return;       // 이미 나간 경우 skip
  Alert.alert('오류', error.message);
}
```

`syncing` 상태가 `true` 일 때는 Back 버튼이 별도 Alert 을 표시하므로,
catch 블록의 Alert 이 동시에 발생하는 경로를 코드 리뷰 시 명시적으로 확인한다.

**체크포인트:**
- [ ] catch 블록 Alert 과 Back 버튼 Alert 이 동시에 발화하는 경로가 있는가
- [ ] 네트워크 재시도 로직이 있다면 이전 Alert 이 닫힌 후에만 재시도하는가

---

## 감지 명령 모음

```bash
# 1. 직접 fetch 호출 (fetchWithTimeout 미사용)
grep -n "await fetch(" reader-mobile/services/githubService.ts

# 2. await 뒤 가드 없는 setState (isMountedRef 누락 가능성)
grep -rn "setSyncing\|setColumns\|setLoading\|Alert\.alert" reader-mobile/app/ | \
  grep -v "isMountedRef"

# 3. 저장 전 hasExistingToken 상태 갱신
grep -A3 "setHasExistingToken(true)" reader-mobile/app/config.tsx

# 4. validateRepoUrl 반환값 boolean 처리
grep -rn "validateRepoUrl" reader-mobile/ | grep "=== true\|=== false\|if (await"

# 5. SecureStore 키 불일치
grep -n "GITHUB_TOKEN_KEY\|github_access_token\|pbd_github_token" \
  reader-mobile/services/secureConfigService.ts \
  reader-mobile/services/tokenService.ts

# 6. 터치 타깃 hitSlop 누락
grep -rn "Ionicons\|Feather\|MaterialIcons" reader-mobile/app/ | \
  grep -v "hitSlop"

# 7. 아이콘 버튼 accessibilityLabel 누락
grep -rn "TouchableOpacity" reader-mobile/app/ | \
  grep -v "accessibilityLabel\|Text>"

# 8. Animated useNativeDriver 누락
grep -rn "Animated\.timing\|Animated\.spring" reader-mobile/ | \
  grep -v "useNativeDriver"

# 9. FlatList keyExtractor index 사용
grep -rn "keyExtractor" reader-mobile/ | grep "index"

# 10. Safe Area 하드코딩 패딩
grep -rn "paddingTop: [0-9]\{2\}\|paddingBottom: [0-9]\{2\}" reader-mobile/app/
```

---

## 심각도 기준 (reader-mobile)

| 레이블 | 조건 |
|--------|------|
| `[critical]` | 직접 `fetch()` 사용, isMountedRef 없이 async setState, SecureStore 키 불일치 |
| `[major]` | `useEffect` 단독 포커스 복귀 로드, 로딩/에러/빈 상태 누락, 동기화 중 뒤로가기 무방비, 아이콘 버튼 `accessibilityLabel` 누락, `hitSlop` 없는 소형 버튼, `useNativeDriver` 누락, Safe Area 하드코딩, Alert 중복 발화 경로 |
| `[minor]` | 스크롤 복원 누락, syncProgress 미표시, 에러 메시지 비구체적, FlatList index key, ScrollView + map 긴 리스트 |
| `[nit]` | 한국어 메시지 어색함, `accessibilityHint` 미추가, `returnKeyType` 최적화 |
