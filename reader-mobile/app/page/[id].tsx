import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadPages, getImagePath } from '@/services/cacheService';
import { replaceImagePaths } from '@/services/parserService';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { Page } from '@/types';
import {
  bgPrimary,
  bgSecondary,
  bgTertiary,
  textPrimary,
  textSecondary,
  border,
  accentPrimary,
  warning,
} from '@/constants/colors';

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, [id]);

  async function loadPage() {
    try {
      setLoading(true);
      const pages = await loadPages();
      const foundPage = pages.find((p) => p.id === id);

      if (foundPage) {
        // Replace image paths with local paths
        // Extract all image filenames from markdown content
        const imageRegex = /!\[([^\]]*)\]\(\.images\/([^)]+)\)/g;
        const imageMap = new Map<string, string>();
        let match;

        while ((match = imageRegex.exec(foundPage.content)) !== null) {
          const filename = match[2];
          const localPath = getImagePath(filename);
          console.log('Image mapping:', filename, '->', localPath);
          imageMap.set(filename, localPath);
        }

        // Replace image paths in content
        const processedContent = replaceImagePaths(foundPage.content, imageMap);

        setPage({
          ...foundPage,
          content: processedContent,
        });
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={accentPrimary} />
      </View>
    );
  }

  if (!page) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Page not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, {
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }]}
    >
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{page.title}</Text>

        {/* Metadata */}
        <View style={styles.metadata}>
          {page.kanbanColumn && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Column:</Text>
              <Text style={styles.metadataValue}>{page.kanbanColumn}</Text>
            </View>
          )}

          {page.tags && page.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {page.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {page.dueDate && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Due:</Text>
              <Text style={styles.dueDateValue}>
                {formatDate(page.dueDate)}
              </Text>
            </View>
          )}

          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Updated:</Text>
            <Text style={styles.metadataValue}>
              {formatDate(page.updatedAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Page Content */}
      <View style={styles.contentSection}>
        {page.content ? (
          <MarkdownRenderer content={page.content} />
        ) : (
          <Text style={styles.emptyContent}>No content</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bgPrimary,
  },
  content: {
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: bgPrimary,
  },
  emptyText: {
    color: textSecondary,
    fontSize: 16,
  },
  backBar: {
    backgroundColor: bgSecondary,
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
    backgroundColor: bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  metadata: {
    gap: 8,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataLabel: {
    color: textSecondary,
    fontSize: 12,
    marginRight: 8,
  },
  metadataValue: {
    color: textPrimary,
    fontSize: 12,
  },
  dueDateValue: {
    color: warning,
    fontSize: 12,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: bgTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    color: accentPrimary,
    fontSize: 11,
  },
  contentSection: {
    padding: 16,
  },
  emptyContent: {
    color: textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
