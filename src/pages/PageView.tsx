import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { pageService } from '@/services';
import TiptapEditor from '@/components/TiptapEditor';
import { FindBar } from '@/components/FindBar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MemoPanel } from '@/components/MemoPanel';
import { TocPanel } from '@/components/TocPanel';
import { Terminal } from '@/components/Terminal';
import { usePageSync } from '@/hooks/usePageSync';
import { useHighlightManager } from '@/hooks/useHighlightManager';
import { openExternalUrl } from '@/lib/openExternal';
import './PageView.css';

const DEFAULT_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const {
    pagesArray, removePage, updatePageInStore, columnColors, showToast,
    highlightColors, config, isImmerseMode, setIsImmerseMode,
    pageWidth, setPageWidth, slashCommands,
  } = useStore();
  const pages = pagesArray;

  // ── UI State ──────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [showFindBar, setShowFindBar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const [showToc, setShowToc] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Memo state
  const [memoMode, setMemoMode] = useState(false);
  const [memoPanelWidth, setMemoPanelWidth] = useState(400);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const [lastCreatedMemoId, setLastCreatedMemoId] = useState<string | null>(null);

  // Inline edit state for meta fields
  const [editTitle, setEditTitle] = useState('');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [newColumnInput, setNewColumnInput] = useState('');

  // ── Highlight Manager ─────────────────────────────────────────────
  const {
    highlightsVisible,
    editorRef,
    handleEditorReady: onEditorReady,
    toggleHighlightsVisibility,
  } = useHighlightManager();

  // ── Editor state: cache on every change so saves never need a live editor ──
  const cachedEditorStateRef = useRef<{ content: string } | null>(null);

  const getEditorState = useCallback(() => {
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      // @ts-ignore - tiptap-markdown adds this to storage
      const md = editor.storage.markdown.getMarkdown() as string;
      cachedEditorStateRef.current = { content: md };
      return cachedEditorStateRef.current;
    }
    // Editor destroyed (unmount) or not ready — use last cached state
    return cachedEditorStateRef.current;
  }, [editorRef]);

  // ── Page Sync (autosave) ──────────────────────────────────────────
  const {
    page, loading, content, setContent, saveNow, markDirty, setPage, tocHeadings,
  } = usePageSync({
    pageId, pages,
    onUpdate: updatePageInStore,
    onToast: showToast,
    getEditorState,
  });

  // ── Derived data ──────────────────────────────────────────────────
  const existingColumns = useMemo(
    () => Array.from(new Set(pages.map(p => p.kanbanColumn).filter(Boolean) as string[])),
    [pages]
  );
  const sortedColumnNames = useMemo(
    () => [...existingColumns].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    [existingColumns]
  );
  const getColColor = useCallback((col: string) => {
    const customColor = columnColors[col.toLowerCase()];
    if (customColor) return customColor;
    const stableIndex = sortedColumnNames.findIndex(c => c.toLowerCase() === col.toLowerCase());
    return DEFAULT_PALETTE[stableIndex % DEFAULT_PALETTE.length];
  }, [columnColors, sortedColumnNames]);

  const allTags = useMemo(() => Array.from(new Set(pages.flatMap(p => p.tags))), [pages]);
  const filteredSuggestions = useMemo(
    () => allTags.filter(
      tag => page ? !page.tags.includes(tag) && tag.toLowerCase().includes(tagInput.toLowerCase()) : false
    ).slice(0, 8),
    [allTags, page?.tags, tagInput]
  );

  // ── Content change handler ────────────────────────────────────────
  const handleContentChange = useCallback((markdown: string) => {
    // Eagerly cache editor state so saves work even after editor is destroyed
    cachedEditorStateRef.current = { content: markdown };
    setContent(markdown);
  }, [setContent]);

  // Editor ready handler — no migration needed, file-level migration handles it
  const handleEditorReady = useCallback((editor: any) => {
    onEditorReady(editor);
  }, [onEditorReady]);

  // Sync editTitle when page loads/changes
  useEffect(() => {
    if (page) setEditTitle(page.title);
  }, [page?.id]);

  // ── Metadata handlers (immediate save for meta fields) ────────────
  const handleTitleSave = useCallback(async () => {
    if (!page || editTitle.trim() === page.title) return;
    const newTitle = editTitle.trim() || 'Untitled';
    const updatedPage = { ...page, title: newTitle, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    try { await pageService.updatePageMetadata(page.path, { title: newTitle }); } catch (err) { console.error('Failed to save title:', err); }
  }, [page, editTitle, updatePageInStore, setPage]);

  const handleColumnChange = useCallback(async (newColumn: string) => {
    if (!page) return;
    const updatedPage = { ...page, kanbanColumn: newColumn || undefined, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    try { await pageService.updatePageMetadata(page.path, { kanbanColumn: newColumn || undefined }); } catch (err) { console.error('Failed to save column:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleAddTag = useCallback(async (tag: string) => {
    if (!page || page.tags.includes(tag)) return;
    const newTags = [...page.tags, tag];
    const updatedPage = { ...page, tags: newTags, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    setTagInput('');
    setShowTagSuggestions(false);
    try { await pageService.updatePageMetadata(page.path, { tags: newTags }); } catch (err) { console.error('Failed to save tag:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleRemoveTag = useCallback(async (tag: string) => {
    if (!page) return;
    const newTags = page.tags.filter(t => t !== tag);
    const updatedPage = { ...page, tags: newTags, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    try { await pageService.updatePageMetadata(page.path, { tags: newTags }); } catch (err) { console.error('Failed to save tag:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleDueDateChange = useCallback(async (newDate: string) => {
    if (!page) return;
    const updatedPage = { ...page, dueDate: newDate ? new Date(newDate).toISOString() : undefined, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    try { await pageService.updatePage(updatedPage); } catch (err) { console.error('Failed to save due date:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    setShowTagSuggestions(true);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput.trim());
    } else if (e.key === 'Escape') {
      setTagInput('');
      setShowTagSuggestions(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  // ── Helper: snapshot editor state into cache after mutations ──────
  const snapshotEditorState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    // @ts-ignore
    const md = editor.storage.markdown.getMarkdown() as string;
    cachedEditorStateRef.current = { content: md };
  }, [editorRef]);

  // ── Highlight handlers ────────────────────────────────────────────
  // Called by TiptapEditor's BubbleMenu after it applies a highlight
  const handleBubbleHighlight = useCallback((_color: string, _style: 'highlight' | 'underline') => {
    snapshotEditorState();
    markDirty();
  }, [markDirty, snapshotEditorState]);

  // Called by TiptapEditor's BubbleMenu after it changes a highlight color
  const handleHighlightChangeColor = useCallback((_highlightId: string, _newColor: string) => {
    snapshotEditorState();
    markDirty();
  }, [markDirty, snapshotEditorState]);

  // Called by TiptapEditor's BubbleMenu after it deletes a highlight
  const handleHighlightDelete = useCallback((highlightId: string) => {
    snapshotEditorState();
    // Remove linked memos
    if (page?.memos?.some(m => m.highlightId === highlightId)) {
      const updatedMemos = page.memos!.filter(m => m.highlightId !== highlightId);
      const updatedPage = { ...page, memos: updatedMemos };
      setPage(updatedPage);
      updatePageInStore(updatedPage);
    }
    markDirty();
  }, [page, updatePageInStore, markDirty, setPage, snapshotEditorState]);

  // ── Memo handlers ─────────────────────────────────────────────────
  const handleCreateMemo = useCallback(async (memoContent?: string, highlightId?: string) => {
    if (!page) return;
    const newMemo: import('@/types').Memo = {
      id: crypto.randomUUID(),
      type: highlightId ? 'linked' : 'independent',
      note: memoContent || '',
      highlightId: highlightId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: (page.memos || []).length,
    };
    const updatedMemos = [...(page.memos || []), newMemo];
    const updatedPage = { ...page, memos: updatedMemos, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    setLastCreatedMemoId(newMemo.id);
    try { await pageService.updatePageMetadata(page.path, { memos: updatedMemos }); } catch (err) { console.error('Failed to create memo:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleUpdateMemo = useCallback(async (memoId: string, note: string) => {
    if (!page) return;
    const updatedMemos = (page.memos || []).map(m =>
      m.id === memoId ? { ...m, note, updatedAt: new Date().toISOString() } : m
    );
    const updatedPage = { ...page, memos: updatedMemos, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    try { await pageService.updatePageMetadata(page.path, { memos: updatedMemos }); } catch (err) { console.error('Failed to update memo:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleDeleteMemo = useCallback(async (memoId: string) => {
    if (!page) return;
    const updatedMemos = (page.memos || []).filter(m => m.id !== memoId);
    const updatedPage = { ...page, memos: updatedMemos, updatedAt: new Date().toISOString() };
    setPage(updatedPage);
    updatePageInStore(updatedPage);
    try { await pageService.updatePageMetadata(page.path, { memos: updatedMemos }); } catch (err) { console.error('Failed to delete memo:', err); }
  }, [page, updatePageInStore, setPage]);

  const handleScrollToHighlight = useCallback((highlightId: string) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;

    // Find the highlight mark in the document
    let targetPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false;
      if (!node.isText || node.marks.length === 0) return;
      const mark = node.marks.find(m => m.type.name === 'highlight' && m.attrs.id === highlightId);
      if (mark) targetPos = pos;
    });

    if (targetPos === null) return;

    // Scroll the highlight into view
    editor.commands.setTextSelection(targetPos);
    editor.commands.scrollIntoView();
    editor.commands.blur();
  }, [editorRef]);

  // ── Page actions ──────────────────────────────────────────────────
  const handleDelete = () => setShowDeleteConfirm(true);

  const confirmDelete = async () => {
    if (!page) return;
    const pageTitle = page.title;
    setShowDeleteConfirm(false);
    try {
      await pageService.deletePage(page.path);
      removePage(page.id);
      showToast(`"${pageTitle}" deleted successfully`, 'success');
      setTimeout(() => navigate('/', { replace: true }), 300);
    } catch (error) {
      console.error('Failed to delete page:', error);
      showToast('Failed to delete page. Please try again.', 'error');
    }
  };

  const handleCopyLink = async () => {
    if (!page) return;
    try {
      await navigator.clipboard.writeText(`[[${page.id}|${page.title}]]`);
      showToast('Link copied!', 'success');
    } catch { showToast('Failed to copy link', 'error'); }
  };

  // ── ToC click ─────────────────────────────────────────────────────
  const handleTocClick = useCallback((headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const container = editorContainerRef.current;
    if (!container) return;
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const heading of headings) {
      const headingText = heading.textContent?.toLowerCase().replace(/\s+/g, '-');
      if (headingText === headingId.toLowerCase()) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }, []);

  // ── Scroll to top tracking ────────────────────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => setShowScrollTop(container.scrollTop > 300);
    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  // ── Memo panel resize ─────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = memoPanelWidth;
    e.preventDefault();
  }, [memoPanelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = resizeStartXRef.current - e.clientX;
      const newWidth = resizeStartWidthRef.current + deltaX;
      const maxWidth = window.innerWidth * 0.5;
      setMemoPanelWidth(Math.min(Math.max(newWidth, 360), maxWidth));
    };
    const handleMouseUp = () => { isResizingRef.current = false; };
    if (memoMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [memoMode]);

  // Auto-clear lastCreatedMemoId
  useEffect(() => {
    if (lastCreatedMemoId) {
      const timer = setTimeout(() => setLastCreatedMemoId(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastCreatedMemoId]);

  // Close page menu on click outside
  useEffect(() => {
    if (!showPageMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) {
        setShowPageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPageMenu]);

  // Close column dropdown on click outside
  useEffect(() => {
    if (!showColumnDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColumnDropdown]);

  // External links → system browser (scoped to editor container only)
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Early bailout: If target is not a link and doesn't contain a link, skip expensive traversal
      if (target.tagName !== 'A' && !target.closest('a[href]')) {
        return;
      }

      const link = (target.tagName === 'A' ? target : target.closest('a[href]')) as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Skip internal links (wiki links and page navigation)
      if (link.hasAttribute('data-page-ref') || link.hasAttribute('data-page-id')) return;
      if (href.startsWith('/page/') || href.startsWith('#')) return;

      // External link - open in system browser
      e.preventDefault();
      e.stopPropagation();
      openExternalUrl(href).catch(() => {});
    };

    // Scoped to editor container only - doesn't run on sidebar/modal/header clicks
    container.addEventListener('click', handleEditorClick, false);
    return () => container.removeEventListener('click', handleEditorClick, false);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') { e.preventDefault(); saveNow(); }
      if (mod && e.key === 'f') { e.preventDefault(); setShowFindBar(prev => !prev); }
      if (mod && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (e.shiftKey) {
          if (!memoMode) setMemoMode(true);
          handleCreateMemo();
        } else {
          setMemoMode(prev => !prev);
        }
      }
      if (mod && e.shiftKey && (e.key === 'T' || e.key === 't')) { e.preventDefault(); setShowToc(prev => !prev); }
      if (mod && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        setIsImmerseMode(!isImmerseMode);
        showToast(isImmerseMode ? 'Immerse mode deactivated' : 'Immerse mode activated', 'info');
      }
      if (e.key === 'Escape' && isImmerseMode) { setIsImmerseMode(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveNow, handleCreateMemo, memoMode, isImmerseMode, setIsImmerseMode, showToast]);

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-view">
        <div className="loading-spinner-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="page-view">
        <div className="error">Page not found</div>
      </div>
    );
  }

  return (
    <>
      <div className={`page-view-container ${showTerminal ? 'with-terminal' : ''}`}>
        <div ref={scrollContainerRef} className={`page-view ${isImmerseMode ? 'immerse-mode' : ''} ${pageWidth === 'narrow' ? 'page-narrow' : ''}`}>
          {!isImmerseMode && (
            <div className="page-header">
              <div className="page-actions-bar">
                <button className="btn-icon" onClick={() => navigate(page?.parentId ? `/page/${page.parentId}` : '/')} title="Go back">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="page-actions">
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => setShowToc(!showToc)}
                    title="Table of Contents (Cmd+Shift+T)"
                  >
                    <span className="material-symbols-outlined">toc</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => setPageWidth(pageWidth === 'narrow' ? 'wide' : 'narrow')}
                    title={pageWidth === 'narrow' ? 'Switch to wide layout' : 'Switch to narrow layout'}
                  >
                    <span className="material-symbols-outlined">
                      {pageWidth === 'narrow' ? 'width_wide' : 'width_normal'}
                    </span>
                  </button>
                  <div className="page-menu-container" ref={pageMenuRef}>
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => setShowPageMenu(!showPageMenu)}
                      title="More options"
                    >
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    {showPageMenu && (
                      <div className="page-menu-dropdown">
                        <button className="page-menu-item" onClick={() => { handleCopyLink(); setShowPageMenu(false); }}>
                          <span className="material-symbols-outlined">link</span>
                          Copy Link
                        </button>
                        <button className="page-menu-item" onClick={() => { setMemoMode(!memoMode); setShowPageMenu(false); }}>
                          <span className="material-symbols-outlined">{memoMode ? 'close' : 'sticky_note_2'}</span>
                          {memoMode ? 'Exit Memo Mode' : 'Memo Mode'}
                        </button>
                        <button className="page-menu-item" onClick={() => { toggleHighlightsVisibility(); setShowPageMenu(false); }}>
                          <span className="material-symbols-outlined">{highlightsVisible ? 'visibility_off' : 'visibility'}</span>
                          {highlightsVisible ? 'Hide Highlights' : 'Show Highlights'}
                        </button>
                        <button className="page-menu-item" onClick={() => { setShowTerminal(!showTerminal); setShowPageMenu(false); }}>
                          <span className="material-symbols-outlined">terminal</span>
                          {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
                        </button>
                        <div className="page-menu-divider"></div>
                        <button className="page-menu-item page-menu-item-danger" onClick={() => { setShowPageMenu(false); handleDelete(); }}>
                          <span className="material-symbols-outlined">delete</span>
                          Delete Page
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={`page-header-content ${pageWidth === 'narrow' ? 'width-narrow' : ''}`}>
                <div className="editor-meta">
                  <div className="editor-field">
                    <textarea
                      value={editTitle}
                      onChange={e => {
                        setEditTitle(e.target.value.replace(/\n/g, ''));
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onBlur={handleTitleSave}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
                      className="editor-title-input"
                      placeholder="Untitled"
                      rows={1}
                      ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    />
                  </div>
                  <div className="editor-props">
                    {/* Column */}
                    <div className="editor-prop-row">
                      <span className="editor-prop-label">
                        <span className="material-symbols-outlined">view_column</span>
                        Column
                      </span>
                      <div className="editor-prop-value">
                        <div className="column-selector" ref={columnDropdownRef}>
                          <div className="column-selector-display" onClick={() => setShowColumnDropdown(!showColumnDropdown)}>
                            {page.kanbanColumn ? (
                              <span className="selected-column-chip" style={{ backgroundColor: getColColor(page.kanbanColumn), color: 'white' }}>
                                {page.kanbanColumn}
                                <button type="button" className="chip-remove" onClick={(e) => { e.stopPropagation(); handleColumnChange(''); }}>✕</button>
                              </span>
                            ) : (
                              <span className="column-placeholder">Empty</span>
                            )}
                          </div>
                          {showColumnDropdown && (
                            <div className="column-dropdown">
                              {existingColumns.length > 0 && (
                                <div className="column-chips">
                                  {existingColumns.map(col => (
                                    <button
                                      key={col} type="button"
                                      className={`column-chip ${page.kanbanColumn === col ? 'active' : ''}`}
                                      style={getColColor(col)
                                        ? page.kanbanColumn === col
                                          ? { backgroundColor: getColColor(col), color: 'white', borderColor: 'transparent' }
                                          : { borderColor: getColColor(col), color: getColColor(col) }
                                        : undefined}
                                      onClick={() => { handleColumnChange(col); setShowColumnDropdown(false); }}
                                    >
                                      {col}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="column-new-input">
                                <input
                                  type="text" value={newColumnInput}
                                  onChange={e => setNewColumnInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && newColumnInput.trim()) { handleColumnChange(newColumnInput.trim()); setNewColumnInput(''); setShowColumnDropdown(false); }}}
                                  placeholder="New column..."
                                />
                                <button type="button" className="btn btn-sm"
                                  onClick={() => { if (newColumnInput.trim()) { handleColumnChange(newColumnInput.trim()); setNewColumnInput(''); setShowColumnDropdown(false); }}}
                                  disabled={!newColumnInput.trim()}
                                >Add</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Tags */}
                    <div className="editor-prop-row">
                      <span className="editor-prop-label">
                        <span className="material-symbols-outlined">sell</span>
                        Tags
                      </span>
                      <div className="editor-prop-value">
                        <div className="page-tags-section">
                          {page.tags.map(tag => (
                            <span key={tag} className="page-tag">
                              {tag}
                              <button className="tag-remove-btn" onClick={() => handleRemoveTag(tag)}>×</button>
                            </span>
                          ))}
                          <div className="tag-input-wrapper">
                            <input
                              className="tag-inline-input"
                              value={tagInput}
                              onChange={handleTagInputChange}
                              onKeyDown={handleTagKeyDown}
                              onFocus={() => setShowTagSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                              placeholder={page.tags.length === 0 ? "Add tag..." : "+"}
                            />
                            {showTagSuggestions && tagInput && filteredSuggestions.length > 0 && (
                              <div className="tag-suggestions">
                                {filteredSuggestions.map(tag => (
                                  <button key={tag} onMouseDown={() => handleAddTag(tag)}>{tag}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Due Date */}
                    <div className="editor-prop-row">
                      <span className="editor-prop-label">
                        <span className="material-symbols-outlined">calendar_today</span>
                        Due Date
                      </span>
                      <div className="editor-prop-value">
                        <input type="date" value={page.dueDate ? page.dueDate.slice(0, 10) : ''} onChange={e => handleDueDateChange(e.target.value)} />
                      </div>
                    </div>
                    {/* Created */}
                    <div className="editor-prop-row">
                      <span className="editor-prop-label">
                        <span className="material-symbols-outlined">schedule</span>
                        Created
                      </span>
                      <div className="editor-prop-value">
                        <span className="editor-prop-static">{new Date(page.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Updated */}
                    <div className="editor-prop-row">
                      <span className="editor-prop-label">
                        <span className="material-symbols-outlined">update</span>
                        Updated
                      </span>
                      <div className="editor-prop-value">
                        <span className="editor-prop-static">{new Date(page.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="page-content-layout">
            {showToc && !isImmerseMode && (
              <TocPanel headings={tocHeadings} onHeadingClick={handleTocClick} />
            )}
            <div ref={editorContainerRef} className={`document-view ${pageWidth === 'narrow' ? 'width-narrow' : ''}`}>
              {showFindBar && (
                <FindBar content={content} contentRef={{ current: null }} onClose={() => setShowFindBar(false)} />
              )}
              <TiptapEditor
                content={content}
                onChange={handleContentChange}
                onEditorReady={handleEditorReady}
                readOnly={false}
                pagePath={page.path}
                pages={pages}
                onNavigate={(pid: string) => navigate(`/page/${pid}`)}
                slashCommands={slashCommands}
                highlightColors={highlightColors}
                onHighlight={handleBubbleHighlight}
                onHighlightChangeColor={handleHighlightChangeColor}
                onHighlightDelete={handleHighlightDelete}
              />

              {page.children && page.children.length > 0 && (
                <div className="sub-pages">
                  <h2>Sub-pages</h2>
                  <div className="sub-pages-list">
                    {page.children.map(child => (
                      <Link key={child.id} to={`/page/${child.id}`} className="sub-page-card">
                        <h3>{child.title}</h3>
                        {child.tags.length > 0 && (
                          <div className="tags">
                            {child.tags.map(tag => (
                              <span key={tag} className="tag-small">{tag}</span>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {memoMode && (
          <>
            <div className="memo-resize-handle" onMouseDown={handleResizeStart} />
            <div className="memo-panel-wrapper" style={{ width: `${memoPanelWidth}px` }}>
              <MemoPanel
                memos={page.memos || []}
                onCreateMemo={() => handleCreateMemo()}
                onUpdateMemo={handleUpdateMemo}
                onDeleteMemo={handleDeleteMemo}
                onScrollToHighlight={handleScrollToHighlight}
                lastCreatedMemoId={lastCreatedMemoId}
              />
            </div>
          </>
        )}
        {showTerminal && <Terminal workspacePath={config.workspacePath} />}
      </div>

      {/* Scroll to top button */}
      {showScrollTop && !isImmerseMode && (
        <button className="scroll-to-top" onClick={scrollToTop} title="Scroll to top">
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Page"
        message={`Are you sure you want to delete "${page?.title}"? This will also delete all sub-pages. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        danger={true}
      />
    </>
  );
}
