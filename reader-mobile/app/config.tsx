import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getRepoUrl,
  setRepoUrl,
  getGithubToken,
  setGithubToken,
} from '@/services/secureConfigService';
import {
  bgPrimary,
  bgSecondary,
  textPrimary,
  textSecondary,
  border,
  accentPrimary,
} from '@/constants/colors';

export default function ConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [repoUrl, setRepoUrlState] = useState('');
  const [token, setToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [saving, setSaving] = useState(false);

  // Toast animation
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadInitialValues();
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  async function loadInitialValues() {
    try {
      const url = await getRepoUrl();
      setRepoUrlState(url);

      const existingToken = await getGithubToken();
      setHasExistingToken(existingToken !== null && existingToken.length > 0);
    } catch (error) {
      console.error('Failed to load config values:', error);
    }
  }

  function showToast() {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      toastTimerRef.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 2000);
    });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await setRepoUrl(repoUrl.trim());
      if (token.trim().length > 0) {
        await setGithubToken(token.trim());
        setHasExistingToken(true);
        setToken('');
      }
      showToast();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Nav Bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>설정</Text>
        <View style={styles.navRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section: GitHub 연동 */}
        <Text style={styles.sectionHeader}>GITHUB 연동</Text>

        <View style={styles.sectionCard}>
          {/* Repo URL row */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>레포지토리 URL</Text>
          </View>
          <TextInput
            style={styles.textInput}
            value={repoUrl}
            onChangeText={setRepoUrlState}
            placeholder="https://github.com/owner/repo"
            placeholderTextColor={textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
          />

          <View style={styles.rowDivider} />

          {/* Token row */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>GitHub Access Token</Text>
          </View>
          <View style={styles.tokenInputWrapper}>
            <TextInput
              style={[styles.textInput, styles.tokenInput]}
              value={token}
              onChangeText={setToken}
              placeholder="ghp_xxxxxxxxxxxx"
              placeholderTextColor={textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!tokenVisible}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setTokenVisible((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={tokenVisible ? '토큰 숨기기' : '토큰 보기'}
            >
              <Ionicons
                name={tokenVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={textSecondary}
              />
            </TouchableOpacity>
          </View>

          {hasExistingToken && (
            <Text style={styles.tokenExistsHint}>이미 저장된 토큰이 있습니다 ✓</Text>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="설정 저장"
        >
          <Text style={styles.saveButtonText}>
            {saving ? '저장 중...' : '저장'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Toast */}
      <Animated.View
        style={[
          styles.toast,
          { opacity: toastOpacity, bottom: insets.bottom + 32 },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.toastText}>설정이 저장되었습니다</Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: bgPrimary,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: bgSecondary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 64,
  },
  backText: {
    color: textPrimary,
    fontSize: 16,
    marginLeft: 2,
  },
  navTitle: {
    color: textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  navRight: {
    minWidth: 64,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    color: textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: border,
    marginBottom: 24,
  },
  fieldRow: {
    marginBottom: 6,
  },
  fieldLabel: {
    color: textSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: bgPrimary,
    color: textPrimary,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 4,
  },
  rowDivider: {
    height: 1,
    backgroundColor: border,
    marginVertical: 14,
  },
  tokenInputWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  tokenInput: {
    paddingRight: 44,
    marginBottom: 0,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenExistsHint: {
    color: accentPrimary,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
  },
  saveButton: {
    backgroundColor: accentPrimary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 35, 50, 0.92)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
  },
  toastText: {
    color: textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
});
