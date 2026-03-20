import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadPages, getImagePath } from '@/services/cacheService';
import { replaceImagePaths } from '@/services/parserService';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { Page } from '@/types';

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
        <ActivityIndicator size="large" color="#4fc3f7" />
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
    backgroundColor: '#121212',
  },
  content: {
    paddingBottom: 32,
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
  header: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metadata: {
    gap: 8,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataLabel: {
    color: '#999',
    fontSize: 14,
    marginRight: 8,
  },
  metadataValue: {
    color: '#e0e0e0',
    fontSize: 14,
  },
  dueDateValue: {
    color: '#ffb74d',
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    color: '#4fc3f7',
    fontSize: 12,
  },
  contentSection: {
    padding: 16,
  },
  emptyContent: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
