import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadPages } from '@/services/cacheService';
import { groupPagesByColumn } from '@/services/parserService';
import type { Page } from '@/types';

export default function ColumnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name: string }>();
  const columnName = decodeURIComponent(name || '');

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadColumnPages();
  }, [columnName]);

  async function loadColumnPages() {
    try {
      setLoading(true);
      const allPages = await loadPages();
      const grouped = groupPagesByColumn(allPages);
      setPages(grouped[columnName] || []);
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoading(false);
    }
  }

  function handlePagePress(page: Page) {
    router.push(`/page/${page.id}`);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4fc3f7" />
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No pages in this column</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.columnTitle}>{columnName}</Text>
        <Text style={styles.pageCount}>{pages.length} pages</Text>
      </View>

      <FlatList
        data={pages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.pageCard}
            onPress={() => handlePagePress(item)}
          >
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.pinned && (
                <View style={styles.pinnedBadge}>
                  <Text style={styles.pinnedText}>📌</Text>
                </View>
              )}
            </View>

            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {item.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.pageFooter}>
              <Text style={styles.dateText}>
                Updated {formatDate(item.updatedAt)}
              </Text>
              {item.dueDate && (
                <Text style={styles.dueDateText}>
                  Due {formatDate(item.dueDate)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  backBar: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  columnTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pageCount: {
    color: '#999',
    fontSize: 12,
  },
  listContent: {
    padding: 16,
  },
  pageCard: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pageTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  pinnedBadge: {
    marginLeft: 8,
  },
  pinnedText: {
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    color: '#4fc3f7',
    fontSize: 11,
  },
  pageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#999',
    fontSize: 11,
  },
  dueDateText: {
    color: '#ffb74d',
    fontSize: 11,
    fontWeight: '500',
  },
});
