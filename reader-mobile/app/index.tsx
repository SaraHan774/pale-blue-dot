import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadPages } from '@/services/cacheService';
import { syncRepository, validateRepoUrl } from '@/services/githubService';
import { extractColumns } from '@/services/parserService';
import { getRepoUrl } from '@/services/secureConfigService';
import {
  bgPrimary,
  bgSecondary,
  textPrimary,
  textSecondary,
  border,
  accentPrimary,
} from '@/constants/colors';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [hasData, setHasData] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCachedData();
    }, [])
  );

  async function loadCachedData() {
    try {
      setLoading(true);
      const pages = await loadPages();
      if (pages.length > 0) {
        const cols = extractColumns(pages);
        setColumns(cols);
        setHasData(true);
      }
    } catch (error) {
      console.error('Failed to load cached data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setSyncProgress('저장소 확인 중...');

      const repoUrl = await getRepoUrl();

      try {
        await validateRepoUrl(repoUrl);
      } catch (e: any) {
        const status = e?.status;
        const hint = status === 401 || status === 403
          ? '토큰이 없거나 만료되었습니다.\n설정(⚙)에서 Access Token을 확인해주세요.'
          : status === 404
          ? '저장소를 찾을 수 없습니다.\n설정(⚙)에서 URL을 확인해주세요.'
          : `저장소 연결 실패 (${e.message})\n설정(⚙)에서 URL과 Token을 확인해주세요.`;
        Alert.alert('연결 실패', hint);
        return;
      }

      const result = await syncRepository(repoUrl, (stage, current, total) => {
        if (current !== undefined && total !== undefined) {
          setSyncProgress(`${stage} (${current}/${total})`);
        } else {
          setSyncProgress(stage);
        }
      });

      await loadCachedData();

      const { stats } = result;
      const message = stats
        ? `${result.pages.length}개 페이지, ${result.imageCount}개 이미지\n\n` +
          `다운로드: ${stats.filesDownloaded}개 / 캐시: ${stats.filesCached}개`
        : `${result.pages.length}개 페이지, ${result.imageCount}개 이미지`;

      Alert.alert('동기화 완료', message);
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('오류', error.message || '동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  }

  function handleColumnPress(columnName: string) {
    router.push(`/column/${encodeURIComponent(columnName)}`);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={accentPrimary} />
        <Text style={styles.loadingText}>불러오는 중...</Text>
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
        <View style={styles.appBarRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleSync}
            disabled={syncing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="동기화"
          >
            {syncing
              ? <ActivityIndicator size="small" color={accentPrimary} />
              : <Ionicons name="refresh-outline" size={22} color={textPrimary} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/config')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="설정"
          >
            <Ionicons name="settings-outline" size={22} color={textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {syncing && (
        <Text style={styles.progressText}>{syncProgress}</Text>
      )}

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
          <Ionicons name="cloud-download-outline" size={48} color={textSecondary} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>저장소가 없습니다</Text>
          <Text style={styles.emptyText}>
            우상단 ⚙ 설정에서 GitHub 저장소 URL과{'\n'}Access Token을 입력하고 저장하세요.
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
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  progressText: {
    color: accentPrimary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: border,
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
  emptyTitle: {
    color: textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
