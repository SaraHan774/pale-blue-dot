import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadPages, loadRepoConfig } from '@/services/cacheService';
import { syncRepository, validateRepoUrl } from '@/services/githubService';
import { extractColumns } from '@/services/parserService';
import { loadToken, saveToken, deleteToken, hasToken } from '@/services/tokenService';
import type { Page } from '@/types';
import {
  bgPrimary,
  bgSecondary,
  bgTertiary,
  textPrimary,
  textSecondary,
  border,
  accentPrimary,
} from '@/constants/colors';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [repoUrl, setRepoUrl] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [hasData, setHasData] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [isRepoSectionExpanded, setIsRepoSectionExpanded] = useState(false);

  useEffect(() => {
    console.log('Safe Area Insets:', insets);
    loadCachedData();
    checkToken();
  }, [insets]);

  async function checkToken() {
    const tokenExists = await hasToken();
    setHasStoredToken(tokenExists);
  }

  async function loadCachedData() {
    try {
      setLoading(true);

      // Load cached pages
      const pages = await loadPages();
      if (pages.length > 0) {
        const cols = extractColumns(pages);
        setColumns(cols);
        setHasData(true);
      }

      // Load repo config
      const config = await loadRepoConfig();
      if (config) {
        setRepoUrl(`https://github.com/${config.owner}/${config.repo}`);
      }
    } catch (error) {
      console.error('Failed to load cached data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!repoUrl.trim()) {
      Alert.alert('Error', 'Please enter a GitHub repository URL');
      return;
    }

    try {
      setSyncing(true);
      setSyncProgress('Validating repository...');

      // Check if token is needed
      const tokenExists = await hasToken();
      console.log('Token exists:', tokenExists);

      // Validate URL
      const isValid = await validateRepoUrl(repoUrl);
      if (!isValid) {
        const errorMsg = tokenExists
          ? 'Repository not found or token is invalid/expired.\n\nFor private repos:\n1. Check the repository URL\n2. Verify your token has "repo" permissions\n3. Token may have expired'
          : 'Repository not found.\n\nFor private repos:\n1. Add a GitHub Personal Access Token\n2. Token needs "repo" permissions';

        Alert.alert('Error', errorMsg);
        return;
      }

      // Sync repository
      const result = await syncRepository(repoUrl, (stage, current, total) => {
        if (current !== undefined && total !== undefined) {
          setSyncProgress(`${stage} (${current}/${total})`);
        } else {
          setSyncProgress(stage);
        }
      });

      // Reload data
      await loadCachedData();

      // Show success with cache stats
      const { stats } = result;
      const message = stats
        ? `Synced ${result.pages.length} pages and ${result.imageCount} images\n\n` +
          `📥 Downloaded: ${stats.filesDownloaded} pages, ${stats.imagesDownloaded} images\n` +
          `⚡ Cached: ${stats.filesCached} pages, ${stats.imagesCached} images`
        : `Downloaded ${result.pages.length} pages and ${result.imageCount} images`;

      Alert.alert('Success', message);
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Error', error.message || 'Failed to sync repository');
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  }

  function handleColumnPress(columnName: string) {
    router.push(`/column/${encodeURIComponent(columnName)}`);
  }

  async function handleSaveToken() {
    if (!tokenInput.trim()) {
      Alert.alert('Error', 'Please enter a token');
      return;
    }

    try {
      const token = tokenInput.trim();
      console.log('Saving token, length:', token.length);
      console.log('Token prefix:', token.substring(0, 4));

      await saveToken(token);

      // Verify it was saved
      const savedToken = await loadToken();
      console.log('Token saved and verified:', savedToken ? 'Yes' : 'No');

      setHasStoredToken(true);
      setShowTokenModal(false);
      setTokenInput('');
      Alert.alert('Success', 'GitHub token saved securely');
    } catch (error: any) {
      console.error('Failed to save token:', error);
      Alert.alert('Error', `Failed to save token: ${error.message}`);
    }
  }

  async function handleDeleteToken() {
    Alert.alert(
      'Delete Token',
      'Are you sure you want to delete the stored token?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteToken();
              setHasStoredToken(false);
              Alert.alert('Success', 'Token deleted');
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete token');
            }
          },
        },
      ]
    );
  }

  function openTokenModal() {
    setTokenInput('');
    setShowTokenModal(true);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={accentPrimary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      {/* App Bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appBarTitle}>Pale Blue Dot</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/config')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="설정"
        >
          <Ionicons name="settings-outline" size={22} color={textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Repo URL Input */}
      <View style={styles.inputSection}>
        <TouchableOpacity
          style={styles.headerRow}
          onPress={() => setIsRepoSectionExpanded(!isRepoSectionExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.label}>
            {isRepoSectionExpanded ? '▼' : '▶'} GitHub Repository URL
          </Text>
          {!isRepoSectionExpanded && (
            <TouchableOpacity
              style={styles.tokenButton}
              onPress={(e) => {
                e.stopPropagation();
                openTokenModal();
              }}
            >
              <Text style={styles.tokenButtonText}>
                🔑 {hasStoredToken ? 'Token Set' : 'Add Token'}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {isRepoSectionExpanded && (
          <>
            <View style={styles.tokenButtonContainer}>
              <TouchableOpacity
                style={styles.tokenButton}
                onPress={openTokenModal}
              >
                <Text style={styles.tokenButtonText}>
                  🔑 {hasStoredToken ? 'Token Set' : 'Add Token'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={repoUrl}
              onChangeText={setRepoUrl}
              placeholder="https://github.com/owner/repo"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
              onPress={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>
                  {hasData ? 'Refresh' : 'Download'}
                </Text>
              )}
            </TouchableOpacity>
            {syncing && (
              <Text style={styles.progressText}>{syncProgress}</Text>
            )}
          </>
        )}
      </View>

      {/* Token Modal */}
      <Modal
        visible={showTokenModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTokenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>GitHub Access Token</Text>
              <Text style={styles.modalDescription}>
                Required for private repositories.
                {'\n\n'}Fine-grained token (Recommended):
                {'\n'}github.com/settings/personal-access-tokens/new
                {'\n'}• Starts with: github_pat_
                {'\n'}• Permissions: Contents (Read), Metadata (Read)
                {'\n\n'}Classic token:
                {'\n'}github.com/settings/tokens
                {'\n'}• Starts with: ghp_
                {'\n'}• Scope: repo (Full control)
              </Text>

              <TextInput
                style={styles.modalInput}
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="ghp_xxxxxxxxxxxx"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={true}
                multiline={false}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleSaveToken}
                >
                  <Text style={styles.modalButtonTextPrimary}>Save Token</Text>
                </TouchableOpacity>

                {hasStoredToken && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonDanger]}
                    onPress={handleDeleteToken}
                  >
                    <Text style={styles.modalButtonTextDanger}>Delete Token</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowTokenModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Columns List */}
      {columns.length > 0 ? (
        <View style={styles.columnsSection}>
          <Text style={styles.sectionTitle}>Columns</Text>
          <FlatList
            data={columns}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.columnCard}
                onPress={() => handleColumnPress(item)}
              >
                <Text style={styles.columnName}>{item}</Text>
                <Text style={styles.columnArrow}>›</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Enter a GitHub repository URL above to get started
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bgPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: bgPrimary,
  },
  loadingText: {
    color: textPrimary,
    marginTop: 12,
    fontSize: 14,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: bgSecondary,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  appBarTitle: {
    color: textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 4,
  },
  inputSection: {
    padding: 16,
    backgroundColor: bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  label: {
    color: textPrimary,
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: bgTertiary,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    fontSize: 14,
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: accentPrimary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressText: {
    color: accentPrimary,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  columnsSection: {
    flex: 1,
  },
  sectionTitle: {
    color: textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    padding: 16,
    paddingBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  columnCard: {
    backgroundColor: bgSecondary,
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  columnName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  columnArrow: {
    color: accentPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  tokenButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  tokenButton: {
    backgroundColor: bgTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tokenButtonText: {
    color: accentPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: bgSecondary,
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalDescription: {
    color: textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: bgTertiary,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    fontSize: 14,
    marginBottom: 20,
    height: 44,
    maxHeight: 44,
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: accentPrimary,
  },
  modalButtonSecondary: {
    backgroundColor: bgTertiary,
  },
  modalButtonDanger: {
    backgroundColor: '#f44336',
  },
  modalButtonTextPrimary: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtonTextSecondary: {
    color: textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextDanger: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
