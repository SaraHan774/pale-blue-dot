import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { loadPages, getImagePath, updatePageContent, saveMemo, deleteMemo } from '@/services/cacheService';
import { replaceImagePaths } from '@/services/parserService';
import type { Page, Memo } from '@/types';
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

function generateMemoId(): string {
  return 'memo-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

  // Scroll position tracking (throttled)
  var scrollTimer = null;
  document.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'scroll',
        y: Math.round(window.scrollY)
      }));
    }, 100);
  }, { passive: true });

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

// ─── Unified Highlight Bottom Sheet ──────────────────────────────────
// Handles both new-selection color pick AND existing-highlight edit+memo.
// Isolated component so TextInput state changes don't re-render the WebView.

interface HighlightSheetProps {
  visible: boolean;
  mode: 'new' | 'edit';
  highlightText: string;
  highlightColor: string;
  highlightId: string;
  memos: import('@/types').Memo[];
  slideAnim: Animated.Value;
  bottomInset: number;
  onClose: () => void;
  onSelectColor: (color: string) => void;
  onDelete: () => void;
  onSaveMemo: (text: string) => Promise<void>;
  onDeleteMemo: (memoId: string) => Promise<void>;
}

function HighlightSheet({
  visible,
  mode,
  highlightText,
  highlightColor,
  highlightId,
  memos,
  slideAnim,
  bottomInset,
  onClose,
  onSelectColor,
  onDelete,
  onSaveMemo,
  onDeleteMemo,
}: HighlightSheetProps) {
  const [newMemoText, setNewMemoText] = useState('');
  const [saving, setSaving] = useState(false);

  const linkedMemos = memos
    .filter((m) => m.highlightId === highlightId)
    .sort((a, b) => a.order - b.order);

  async function handleSaveMemo() {
    if (!newMemoText.trim() || saving) return;
    setSaving(true);
    try {
      await onSaveMemo(newMemoText.trim());
      setNewMemoText('');
    } finally {
      setSaving(false);
    }
  }

  const label = highlightText.length > 45
    ? highlightText.slice(0, 45) + '…'
    : highlightText;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={sheetStyles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={sheetStyles.overlay} onPress={onClose} />
        <Animated.View
          style={[
            sheetStyles.container,
            { paddingBottom: bottomInset + 20, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={sheetStyles.handle} />

          {/* Header */}
          <View style={sheetStyles.header}>
            <View style={[sheetStyles.quoteBar, { backgroundColor: highlightColor || '#FFEB3B' }]} />
            <Text style={sheetStyles.headerText} numberOfLines={2}>{label}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Color row */}
          <View style={sheetStyles.section}>
            <Text style={sheetStyles.sectionLabel}>
              {mode === 'new' ? '색상 선택' : '색상'}
            </Text>
            <View style={sheetStyles.colorRow}>
              {HIGHLIGHT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    sheetStyles.colorDot,
                    { backgroundColor: color },
                    mode === 'edit' && color === highlightColor && sheetStyles.colorDotActive,
                  ]}
                  onPress={() => onSelectColor(color)}
                  accessibilityLabel={`색상 ${color}`}
                >
                  {mode === 'edit' && color === highlightColor && (
                    <Ionicons name="checkmark" size={16} color="rgba(0,0,0,0.5)" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Memo section — only in edit mode */}
          {mode === 'edit' && (
            <>
              <View style={sheetStyles.divider} />
              <View style={sheetStyles.section}>
                <Text style={sheetStyles.sectionLabel}>메모</Text>

                {linkedMemos.length > 0 && (
                  <ScrollView
                    style={sheetStyles.memoList}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {linkedMemos.map((memo) => (
                      <View key={memo.id} style={sheetStyles.memoItem}>
                        <Text style={sheetStyles.memoNote}>{memo.note}</Text>
                        <View style={sheetStyles.memoFooter}>
                          <Text style={sheetStyles.memoDate}>
                            {new Date(memo.createdAt).toLocaleDateString('ko-KR', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onDeleteMemo(memo.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={sheetStyles.inputRow}>
                  <TextInput
                    style={sheetStyles.input}
                    placeholder="메모 추가..."
                    placeholderTextColor={textSecondary}
                    value={newMemoText}
                    onChangeText={setNewMemoText}
                    multiline
                    maxLength={500}
                    accessibilityLabel="메모 입력"
                  />
                  <TouchableOpacity
                    style={[sheetStyles.sendBtn, (!newMemoText.trim() || saving) && sheetStyles.sendBtnDisabled]}
                    onPress={handleSaveMemo}
                    disabled={!newMemoText.trim() || saving}
                    accessibilityLabel="메모 저장"
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="arrow-up" size={18} color="#fff" />
                    }
                  </TouchableOpacity>
                </View>
              </View>

              {/* Delete highlight */}
              <View style={sheetStyles.divider} />
              <TouchableOpacity style={sheetStyles.deleteRow} onPress={onDelete}>
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                <Text style={sheetStyles.deleteText}>하이라이트 삭제</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  container: {
    backgroundColor: bgSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: SCREEN_HEIGHT * 0.78,
    borderTopWidth: 1,
    borderColor: border,
  },
  handle: {
    width: 36, height: 4, backgroundColor: border, borderRadius: 2,
    alignSelf: 'center', marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 16,
  },
  quoteBar: {
    width: 3, borderRadius: 2, minHeight: 16, marginTop: 2,
  },
  headerText: {
    flex: 1, color: textSecondary, fontSize: 13, lineHeight: 19,
  },
  section: { marginBottom: 4 },
  sectionLabel: {
    color: textSecondary, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
  },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  colorDot: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: 'rgba(255,255,255,0.7)',
    transform: [{ scale: 1.1 }],
  },
  divider: { height: 1, backgroundColor: border, marginVertical: 14 },
  memoList: { maxHeight: SCREEN_HEIGHT * 0.28, marginBottom: 10 },
  memoItem: {
    backgroundColor: bgTertiary, borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  memoNote: { color: textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  memoFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  memoDate: { color: textSecondary, fontSize: 11 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, backgroundColor: bgTertiary, color: textPrimary, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    maxHeight: 90, borderWidth: 1, borderColor: border,
  },
  sendBtn: {
    backgroundColor: accentPrimary, borderRadius: 20, width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  deleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10,
  },
  deleteText: { color: '#FF6B6B', fontSize: 14 },
});

// ─── Main Screen ─────────────────────────────────────────────────────

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw content (original markdown, for highlight insertion)
  const rawContentRef = useRef<string>('');

  // WebView ref and scroll position tracking
  const webViewRef = useRef<WebView>(null);
  const scrollYRef = useRef<number>(0);

  // WebView HTML
  const [webViewHtml, setWebViewHtml] = useState<string>('');

  // Highlight UI state — new selection
  const [selectedText, setSelectedText] = useState<string>('');

  // Highlight UI state — existing highlight tap
  const [tappedHighlightId, setTappedHighlightId] = useState<string>('');
  const [tappedHighlightColor, setTappedHighlightColor] = useState<string>('');
  const [tappedHighlightText, setTappedHighlightText] = useState<string>('');

  // Unified bottom sheet: 'none' | 'new' | 'edit'
  const [sheetMode, setSheetMode] = useState<'none' | 'new' | 'edit'>('none');
  const sheetSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
      if (msg.type === 'scroll') {
        scrollYRef.current = (msg as { type: string; y?: number }).y ?? 0;
      } else if (msg.type === 'selection' && msg.text && msg.text.trim().length > 0) {
        setSelectedText(msg.text.trim());
        openSheet('new');
      } else if (msg.type === 'selectionClear') {
        if (sheetModeRef.current === 'new') closeSheet();
      } else if (msg.type === 'highlightTap' && msg.highlightId) {
        setTappedHighlightId(msg.highlightId);
        setTappedHighlightColor(msg.highlightColor ?? '#FFEB3B');
        setTappedHighlightText(msg.highlightText ?? '');
        openSheet('edit');
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  const sheetModeRef = useRef<'none' | 'new' | 'edit'>('none');

  function openSheet(mode: 'new' | 'edit') {
    sheetModeRef.current = mode;
    setSheetMode(mode);
    Animated.spring(sheetSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 70,
      friction: 12,
    }).start();
  }

  function closeSheet() {
    Animated.timing(sheetSlideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      sheetModeRef.current = 'none';
      setSheetMode('none');
      setSelectedText('');
      setTappedHighlightId('');
      setTappedHighlightColor('');
      setTappedHighlightText('');
    });
  }

  async function handleSelectColor(color: string) {
    if (sheetMode === 'new') {
      if (!page || !selectedText) return;
      closeSheet();
      const newId = generateId();
      const updatedContent = insertHighlight(rawContentRef.current, selectedText, color, newId);
      if (updatedContent === rawContentRef.current) return;
      rawContentRef.current = updatedContent;
      setPage({ ...page, content: updatedContent });
      rebuildWebView(updatedContent);
      try { await updatePageContent(page.id, updatedContent); } catch { /* noop */ }
    } else {
      if (!page || !tappedHighlightId) return;
      setTappedHighlightColor(color);
      const updatedContent = changeHighlightColor(rawContentRef.current, tappedHighlightId, color);
      rawContentRef.current = updatedContent;
      setPage({ ...page, content: updatedContent });
      rebuildWebView(updatedContent);
      try { await updatePageContent(page.id, updatedContent); } catch { /* noop */ }
    }
  }

  async function handleHighlightDelete() {
    if (!page || !tappedHighlightId) return;
    closeSheet();
    const updatedContent = removeHighlight(rawContentRef.current, tappedHighlightId);
    rawContentRef.current = updatedContent;
    setPage({ ...page, content: updatedContent });
    rebuildWebView(updatedContent);
    try { await updatePageContent(page.id, updatedContent); } catch { /* noop */ }
  }

  async function handleSaveMemo(text: string) {
    if (!page || !text.trim() || !tappedHighlightId) return;
    const now = new Date().toISOString();
    const linkedMemos = (page.memos ?? []).filter((m) => m.highlightId === tappedHighlightId);
    const newMemo: Memo = {
      id: generateMemoId(),
      type: 'linked',
      note: text,
      highlightId: tappedHighlightId,
      highlightText: tappedHighlightText,
      highlightColor: tappedHighlightColor || '#FFEB3B',
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: linkedMemos.length,
    };
    await saveMemo(page.id, newMemo);
    setPage((prev) => prev ? { ...prev, memos: [...(prev.memos ?? []), newMemo] } : prev);
  }

  async function handleDeleteMemo(memoId: string) {
    if (!page) return;
    try {
      await deleteMemo(page.id, memoId);
      setPage((prev) =>
        prev ? { ...prev, memos: (prev.memos ?? []).filter((m) => m.id !== memoId) } : prev
      );
    } catch (error) {
      console.error('Failed to delete memo:', error);
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
            <View style={styles.columnChip}>
              <Ionicons name="folder-outline" size={11} color={accentPrimary} />
              <Text style={styles.columnChipText}>{page.kanbanColumn}</Text>
            </View>
          )}

          {page.tags && page.tags.length > 0 && (
            <>
              {page.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </>
          )}

          {page.dueDate && (
            <View style={styles.dueDateChip}>
              <Ionicons name="calendar-outline" size={11} color={warning} />
              <Text style={styles.dueDateChipText}>{formatDate(page.dueDate)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.updatedAt}>
          {formatDate(page.updatedAt)}
        </Text>
      </View>


      {/* Page Content via WebView */}
      <WebView
        ref={webViewRef}
        style={styles.webView}
        source={{ html: webViewHtml }}
        onMessage={handleWebViewMessage}
        onLoadEnd={() => {
          const y = scrollYRef.current;
          if (y > 0) {
            webViewRef.current?.injectJavaScript(`window.scrollTo(0, ${y}); true;`);
          }
        }}
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

      {/* Unified Highlight Bottom Sheet */}
      <HighlightSheet
        visible={sheetMode !== 'none'}
        mode={sheetMode === 'none' ? 'new' : sheetMode}
        highlightText={sheetMode === 'new' ? selectedText : tappedHighlightText}
        highlightColor={tappedHighlightColor}
        highlightId={tappedHighlightId}
        memos={page?.memos ?? []}
        slideAnim={sheetSlideAnim}
        bottomInset={insets.bottom}
        onClose={closeSheet}
        onSelectColor={handleSelectColor}
        onDelete={handleHighlightDelete}
        onSaveMemo={handleSaveMemo}
        onDeleteMemo={handleDeleteMemo}
      />
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  columnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  columnChipText: {
    color: accentPrimary,
    fontSize: 11,
    fontWeight: '500',
  },
  tag: {
    backgroundColor: bgTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagText: {
    color: textSecondary,
    fontSize: 11,
  },
  dueDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,160,0,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,160,0,0.25)',
  },
  dueDateChipText: {
    color: warning,
    fontSize: 11,
    fontWeight: '500',
  },
  updatedAt: {
    color: textSecondary,
    fontSize: 11,
    marginTop: 8,
    opacity: 0.6,
  },
  webView: {
    flex: 1,
    backgroundColor: bgPrimary,
  },
});
