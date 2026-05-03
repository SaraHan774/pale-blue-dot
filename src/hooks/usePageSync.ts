import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Page } from '@/types';
import { pageService, fileSystemService } from '@/services';
import { tocService } from '@/services/tocService';

const isTauri = '__TAURI_INTERNALS__' in window;
const AUTOSAVE_DELAY = 1500;

interface UsePageSyncOptions {
  pageId: string | undefined;
  pages: Record<string, Page>;
  onUpdate: (page: Page) => void;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
  /** Pull fresh content from the editor at save time.
   *  MUST return cached state even if the editor is destroyed. */
  getEditorState?: () => { content: string } | null;
  /** Number of pages — used to trigger retry effect without iterating the map. */
  pagesCount?: number;
}

export function usePageSync({ pageId, pages, onUpdate, onToast, getEditorState, pagesCount }: UsePageSyncOptions) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [tocHeadings, setTocHeadings] = useState<any[]>([]);

  // ── Refs: keep latest values accessible without recreating callbacks ──
  const pageRef = useRef<Page | null>(null);
  const pagesRef = useRef<Record<string, Page>>(pages);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTimeRef = useRef(0);
  const savingRef = useRef(false);
  const getEditorStateRef = useRef(getEditorState);
  const onUpdateRef = useRef(onUpdate);
  const onToastRef = useRef(onToast);
  const loadedPageIdRef = useRef<string | null>(null);

  // Sync refs
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { getEditorStateRef.current = getEditorState; }, [getEditorState]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onToastRef.current = onToast; }, [onToast]);

  // ── Synchronous flush helper (for navigation/unmount — no async) ────
  const flushSync = useCallback(() => {
    const currentPage = pageRef.current;
    if (!currentPage || !dirtyRef.current) return;

    // Cancel pending timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const editorState = getEditorStateRef.current?.();
    if (!editorState) return;

    dirtyRef.current = false;

    const updatedPage: Page = {
      ...currentPage,
      content: editorState.content,
      updatedAt: new Date().toISOString(),
    };
    // Clear legacy highlights after migration (they're now inline in content)
    delete updatedPage.highlights;

    lastSaveTimeRef.current = Date.now();
    pageRef.current = updatedPage;
    onUpdateRef.current(updatedPage);
    // Fire-and-forget disk write
    pageService.updatePage(updatedPage).catch((err) => {
      console.error('Flush save failed:', err);
    });
  }, []); // Stable: zero deps, reads from refs

  // ── flushSave: async version for autosave timer ────────────────────
  const flushSave = useCallback(async () => {
    const currentPage = pageRef.current;
    if (!currentPage || !dirtyRef.current || savingRef.current) return;

    const editorState = getEditorStateRef.current?.();
    if (!editorState) return;

    dirtyRef.current = false;
    savingRef.current = true;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const updatedPage: Page = {
      ...currentPage,
      content: editorState.content,
      updatedAt: new Date().toISOString(),
    };
    // Clear legacy highlights after migration (they're now inline in content)
    delete updatedPage.highlights;

    try {
      lastSaveTimeRef.current = Date.now();
      pageRef.current = updatedPage;
      setPage(updatedPage);
      onUpdateRef.current(updatedPage);
      await pageService.updatePage(updatedPage);
    } catch (err) {
      console.error('Autosave failed:', err);
      dirtyRef.current = true; // retry next cycle
    } finally {
      savingRef.current = false;
    }
  }, []); // Stable: zero deps, reads from refs

  // ── markDirty: stable function, schedules autosave ────────────────
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(flushSave, AUTOSAVE_DELAY);
  }, [flushSave]);

  // ── saveNow: immediate flush (Cmd+S) ─────────────────────────────
  const saveNow = useCallback(async () => {
    dirtyRef.current = true;
    await flushSave();
  }, [flushSave]);

  // ── updateContent: called by parent on editor changes ─────────────
  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    const headings = tocService.extractHeadings(newContent);
    setTocHeadings(headings);
    markDirty();
  }, [markDirty]);

  // ── Load page (stable — uses refs for pages) ──────────────────────
  const loadPage = useCallback(async (id: string) => {
    const currentPages = pagesRef.current;
    const foundPage = currentPages[id];  // O(1) map access
    if (!foundPage) return;

    try {
      const fullPage = await pageService.loadPageWithChildren(foundPage.path);
      loadedPageIdRef.current = id;
      setPage(fullPage);
      setContent(fullPage.content);
      dirtyRef.current = false;

      const headings = tocService.extractHeadings(fullPage.content);
      setTocHeadings(headings);

      if (isTauri && fullPage.path) {
        try {
          const rootHandle = fileSystemService.getRootHandle();
          const absolutePath = typeof rootHandle === 'string'
            ? `${rootHandle}/${fullPage.path}`
            : fullPage.path;
          await invoke('watch_file', { filePath: absolutePath });
        } catch (err) {
          console.error('Failed to start file watcher:', err);
        }
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Flush pending saves BEFORE switching pages ─────────────────────
  // This effect runs when pageId changes. The cleanup fires for the OLD
  // pageId, flushing any unsaved edits before the new page loads.
  useEffect(() => {
    return () => {
      flushSync();
    };
  }, [pageId, flushSync]);

  // Load page on pageId change
  useEffect(() => {
    if (!pageId) return;
    if (loadedPageIdRef.current !== pageId) {
      setLoading(true);
    }
    loadPage(pageId);
  }, [pageId, loadPage]);

  // Retry when pages become available (only if page hasn't loaded yet)
  // Use pagesCount (derived from pageIds.length in store) to avoid iterating the map.
  const resolvedPagesCount = pagesCount ?? Object.keys(pages).length;
  useEffect(() => {
    if (pageId && !page && !loading && resolvedPagesCount > 0) {
      loadPage(pageId);
    }
  }, [resolvedPagesCount, pageId, page, loading, loadPage]);

  // ── Flush on unmount (component removed from DOM) ──────────────────
  useEffect(() => {
    return () => {
      flushSync();
    };
  }, [flushSync]); // flushSync is stable

  // ── Flush on browser close / refresh ──────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSync();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSync]);

  // ── File watcher (external changes only) ──────────────────────────
  useEffect(() => {
    if (!isTauri || !page) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const rootHandle = fileSystemService.getRootHandle();
        const absolutePagePath = typeof rootHandle === 'string'
          ? `${rootHandle}/${page.path}`
          : page.path;

        unlisten = await listen('file-changed', async (event: any) => {
          const changedPath = event.payload as string;
          if (absolutePagePath !== changedPath) return;

          // Skip if we saved recently (our own write)
          if (Date.now() - lastSaveTimeRef.current < 3000) return;

          // Skip if we're in the middle of saving
          if (savingRef.current) return;

          // Skip if we have unsaved changes (user is actively editing)
          if (dirtyRef.current) return;

          try {
            const fullPage = await pageService.loadPageWithChildren(page.path);
            dirtyRef.current = false;
            setPage(fullPage);
            setContent(fullPage.content);
            onUpdateRef.current(fullPage);
            onToastRef.current('Page updated externally', 'info');

            const headings = tocService.extractHeadings(fullPage.content);
            setTocHeadings(headings);
          } catch (err) {
            console.error('Failed to reload page:', err);
          }
        });
      } catch (err) {
        console.error('Failed to setup file change listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
      if (isTauri && page?.path) {
        const rootHandle = fileSystemService.getRootHandle();
        const absolutePath = typeof rootHandle === 'string'
          ? `${rootHandle}/${page.path}`
          : page.path;
        invoke('unwatch_file', { filePath: absolutePath }).catch(() => {});
      }
    };
  }, [page?.path]);

  return {
    page,
    loading,
    content,
    tocHeadings,
    setPage,
    setContent: updateContent,
    saveNow,
    markDirty,
    loadPage,
  };
}
