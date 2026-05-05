import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { loadPages, getImagePath, updatePageContent } from '@/services/cacheService';
import { replaceImagePaths } from '@/services/parserService';
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
import { marked } from 'marked';

// ─── Highlight palette ───────────────────────────────────────────────

export const HIGHLIGHT_COLORS = ['#FFEB3B', '#90EE90', '#ADD8E6', '#FFB6C1', '#FFA500'];

// ─── Pure helpers: insert / change / remove <mark> tags ─────────────

/**
 * Changes the highlight color of an existing <mark> tag identified by
 * `highlightId`. Returns the original content unchanged if not found.
 */
export function changeHighlightColor(
  content: string,
  highlightId: string,
  newColor: string
): string {
  return content.replace(
    new RegExp(
      `(<mark[^>]*data-highlight-id="${highlightId}"[^>]*data-highlight-color=")[^"]*"`
    ),
    `$1${newColor}"`
  );
}

/**
 * Removes the <mark> tag identified by `highlightId`, preserving its
 * inner text. Returns the original content unchanged if not found.
 */
export function removeHighlight(content: string, highlightId: string): string {
  return content.replace(
    new RegExp(
      `<mark[^>]*data-highlight-id="${highlightId}"[^>]*>([\\s\\S]*?)<\\/mark>`
    ),
    '$1'
  );
}

/**
 * Replaces the first occurrence of `selectedText` in `content` with
 * a <mark> tag carrying all required data attributes.
 * Returns the original content unchanged if `selectedText` is not found.
 */
export function insertHighlight(
  content: string,
  selectedText: string,
  color: string,
  id: string
): string {
  if (!selectedText || !content.includes(selectedText)) {
    return content;
  }
  const created = new Date().toISOString();
  const mark =
    `<mark data-highlight-id="${id}" data-highlight-color="${color}" ` +
    `data-highlight-style="highlight" data-highlight-created="${created}">${selectedText}</mark>`;
  return content.replace(selectedText, mark);
}

// ─── UUID generator (no crypto dependency in RN JS context) ─────────

function generateId(): string {
  return 'hl-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

// ─── Build the HTML document injected into WebView ──────────────────

function buildWebViewHtml(htmlBody: string, bgColor: string, fgColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; padding: 16px;
    background-color: ${bgColor};
    color: ${fgColor};
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  }
  h1,h2,h3,h4,h5,h6 { color: #ffffff; }
  a { color: #91C4F2; }
  code { background: #243447; color: #91C4F2; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
  pre { background: #243447; border-radius: 6px; padding: 12px; overflow-x: auto; }
  blockquote { border-left: 4px solid #91C4F2; margin: 8px 0; padding-left: 12px; background: #243447; }
  mark { padding: 0 2px; border-radius: 2px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #2d3f52; padding: 6px 10px; }
  th { background: #243447; color: #ffffff; }
  img { max-width: 100%; border-radius: 6px; }
  hr { border: none; border-top: 1px solid #2d3f52; }
</style>
</head>
<body>
${htmlBody}
<script>
(function() {
  var selectionTimer = null;

  function notifySelection() {
    var sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      var text = sel.toString();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selection', text: text }));
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selectionClear' }));
    }
  }

  document.addEventListener('selectionchange', function() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(notifySelection, 300);
  });

  // Highlight tap: notify RN when user taps an existing <mark> tag
  document.addEventListener('click', function(e) {
    var target = e.target;
    // Walk up the DOM in case the click lands on a child of <mark>
    while (target && target !== document.body) {
      if (target.tagName && target.tagName.toLowerCase() === 'mark') {
        var highlightId = target.getAttribute('data-highlight-id');
        if (highlightId) {
          e.stopPropagation();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'highlightTap',
            highlightId: highlightId,
            highlightColor: target.getAttribute('data-highlight-color') || '#FFEB3B',
            highlightText: target.textContent || ''
          }));
          return;
        }
      }
      target = target.parentElement;
    }
  });
})();
</script>
</body>
</html>`;
}

// ─── Main Screen ─────────────────────────────────────────────────────

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw content (original markdown, for highlight insertion)
  const rawContentRef = useRef<string>('');

  // WebView HTML
  const [webViewHtml, setWebViewHtml] = useState<string>('');

  // Highlight UI state — new selection
  const [selectedText, setSelectedText] = useState<string>('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Highlight UI state — existing highlight tap
  const [tappedHighlightId, setTappedHighlightId] = useState<string>('');
  const [tappedHighlightColor, setTappedHighlightColor] = useState<string>('');
  const [tappedHighlightText, setTappedHighlightText] = useState<string>('');
  const [showHighlightEdit, setShowHighlightEdit] = useState(false);

  useEffect(() => {
    loadPage();
  }, [id]);

  async function loadPage() {
    try {
      setLoading(true);
      const pages = await loadPages();
      const foundPage = pages.find((p) => p.id === id);

      if (foundPage) {
        const imageRegex = /!\[([^\]]*)\]\(\.images\/([^)]+)\)/g;
        const imageMap = new Map<string, string>();
        let match;
        while ((match = imageRegex.exec(foundPage.content)) !== null) {
          const filename = match[2];
          const localPath = getImagePath(filename);
          imageMap.set(filename, localPath);
        }

        const processedContent = replaceImagePaths(foundPage.content, imageMap);

        // Store the processed content as the source of truth for highlight insertion
        rawContentRef.current = processedContent;

        setPage({ ...foundPage, content: processedContent });
        rebuildWebView(processedContent);
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
  }

  function rebuildWebView(content: string) {
    const html = marked(content, { breaks: true, gfm: true }) as string;
    setWebViewHtml(buildWebViewHtml(html, bgPrimary, textPrimary));
  }

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        text?: string;
        highlightId?: string;
        highlightColor?: string;
        highlightText?: string;
      };
      if (msg.type === 'selection' && msg.text && msg.text.trim().length > 0) {
        setSelectedText(msg.text.trim());
        setShowColorPicker(true);
      } else if (msg.type === 'selectionClear') {
        // Only hide if color picker is not open
        setShowColorPicker(false);
        setSelectedText('');
      } else if (
        msg.type === 'highlightTap' &&
        msg.highlightId
      ) {
        setTappedHighlightId(msg.highlightId);
        setTappedHighlightColor(msg.highlightColor ?? '#FFEB3B');
        setTappedHighlightText(msg.highlightText ?? '');
        setShowHighlightEdit(true);
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  async function applyHighlight(color: string) {
    if (!page || !selectedText) return;

    setShowColorPicker(false);

    const newId = generateId();
    const updatedContent = insertHighlight(rawContentRef.current, selectedText, color, newId);

    if (updatedContent === rawContentRef.current) {
      // Text not found, nothing to do
      setSelectedText('');
      return;
    }

    // Update in-memory state
    rawContentRef.current = updatedContent;
    const updatedPage = { ...page, content: updatedContent };
    setPage(updatedPage);
    rebuildWebView(updatedContent);
    setSelectedText('');

    // Persist to cache
    try {
      await updatePageContent(page.id, updatedContent);
    } catch (error) {
      console.error('Failed to save highlight:', error);
    }
  }

  function dismissColorPicker() {
    setShowColorPicker(false);
    setSelectedText('');
  }

  function dismissHighlightEdit() {
    setShowHighlightEdit(false);
    setTappedHighlightId('');
    setTappedHighlightColor('');
    setTappedHighlightText('');
  }

  async function applyHighlightColorChange(newColor: string) {
    if (!page || !tappedHighlightId) return;

    setShowHighlightEdit(false);

    const updatedContent = changeHighlightColor(rawContentRef.current, tappedHighlightId, newColor);

    rawContentRef.current = updatedContent;
    setPage({ ...page, content: updatedContent });
    rebuildWebView(updatedContent);

    try {
      await updatePageContent(page.id, updatedContent);
    } catch (error) {
      console.error('Failed to save highlight color change:', error);
    }

    setTappedHighlightId('');
    setTappedHighlightColor('');
    setTappedHighlightText('');
  }

  async function applyHighlightDelete() {
    if (!page || !tappedHighlightId) return;

    setShowHighlightEdit(false);

    const updatedContent = removeHighlight(rawContentRef.current, tappedHighlightId);

    rawContentRef.current = updatedContent;
    setPage({ ...page, content: updatedContent });
    rebuildWebView(updatedContent);

    try {
      await updatePageContent(page.id, updatedContent);
    } catch (error) {
      console.error('Failed to save highlight deletion:', error);
    }

    setTappedHighlightId('');
    setTappedHighlightColor('');
    setTappedHighlightText('');
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
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
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
              <Text style={styles.dueDateValue}>{formatDate(page.dueDate)}</Text>
            </View>
          )}

          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Updated:</Text>
            <Text style={styles.metadataValue}>{formatDate(page.updatedAt)}</Text>
          </View>
        </View>
      </View>

      {/* Highlight hint banner */}
      <View style={styles.hintBanner}>
        <Ionicons name="hand-left-outline" size={12} color={textSecondary} />
        <Text style={styles.hintText}>  롱프레스로 텍스트 선택 후 색상 버튼을 눌러 하이라이트 추가</Text>
      </View>

      {/* Page Content via WebView */}
      <WebView
        style={styles.webView}
        source={{ html: webViewHtml }}
        onMessage={handleWebViewMessage}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={false}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
      />

      {/* Color Picker Modal — new highlight */}
      <Modal
        visible={showColorPicker}
        transparent
        animationType="fade"
        onRequestClose={dismissColorPicker}
      >
        <Pressable style={styles.modalOverlay} onPress={dismissColorPicker}>
          <Pressable style={styles.colorPickerPanel} onPress={() => {}}>
            <Text style={styles.colorPickerTitle} numberOfLines={2}>
              "{selectedText.length > 40 ? selectedText.slice(0, 40) + '…' : selectedText}"
            </Text>
            <Text style={styles.colorPickerSubtitle}>하이라이트 색상 선택</Text>
            <View style={styles.colorRow}>
              {HIGHLIGHT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorButton, { backgroundColor: color }]}
                  onPress={() => applyHighlight(color)}
                  accessibilityLabel={`하이라이트 색상 ${color}`}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={dismissColorPicker}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Highlight Edit Popover — tap on existing highlight */}
      <Modal
        visible={showHighlightEdit}
        transparent
        animationType="fade"
        onRequestClose={dismissHighlightEdit}
      >
        <Pressable style={styles.modalOverlay} onPress={dismissHighlightEdit}>
          <Pressable style={styles.colorPickerPanel} onPress={() => {}}>
            <Text style={styles.colorPickerTitle} numberOfLines={2}>
              "{tappedHighlightText.length > 40
                ? tappedHighlightText.slice(0, 40) + '…'
                : tappedHighlightText}"
            </Text>
            <Text style={styles.colorPickerSubtitle}>색상 변경</Text>
            <View style={styles.colorRow}>
              {HIGHLIGHT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    color === tappedHighlightColor && styles.colorButtonSelected,
                  ]}
                  onPress={() => applyHighlightColorChange(color)}
                  accessibilityLabel={`하이라이트 색상 변경 ${color}`}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={applyHighlightDelete}
              accessibilityLabel="하이라이트 삭제"
            >
              <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
              <Text style={styles.deleteText}>하이라이트 삭제</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={dismissHighlightEdit}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: bgTertiary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  hintText: {
    color: textSecondary,
    fontSize: 11,
  },
  webView: {
    flex: 1,
    backgroundColor: bgPrimary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerPanel: {
    backgroundColor: bgSecondary,
    borderRadius: 12,
    padding: 20,
    width: 300,
    borderWidth: 1,
    borderColor: border,
  },
  colorPickerTitle: {
    color: textPrimary,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  colorPickerSubtitle: {
    color: textSecondary,
    fontSize: 12,
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    gap: 6,
  },
  deleteText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: textSecondary,
    fontSize: 14,
  },
});
