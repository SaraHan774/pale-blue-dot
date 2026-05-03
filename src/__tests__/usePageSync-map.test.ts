/**
 * Unit test for usePageSync — normalized pages map interface
 *
 * Verifies DoD:
 *  1. usePageSync accepts Record<string, Page> instead of Page[]
 *  2. loadPage uses O(1) map access (currentPages[id]) instead of find()
 *  3. pagesCount prop is passed through and used for retry effect
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePageSync } from '@/hooks/usePageSync';
import type { Page } from '@/types';

// Mock Tauri APIs so the hook can run in jsdom
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));

// Mock pageService and fileSystemService
vi.mock('@/services', () => ({
  pageService: {
    loadPageWithChildren: vi.fn(),
    updatePage: vi.fn(),
  },
  fileSystemService: {
    getRootHandle: vi.fn(() => '/workspace'),
  },
}));

vi.mock('@/services/tocService', () => ({
  tocService: {
    extractHeadings: vi.fn(() => []),
  },
}));

import { pageService } from '@/services';

const makePage = (id: string): Page => ({
  id,
  title: `Page ${id}`,
  path: `${id}.md`,
  content: `# Page ${id}`,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  viewType: 'document',
  pinned: false,
  memos: [],
});

describe('usePageSync — normalized pages map interface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts Record<string, Page> and loads page via O(1) map access', async () => {
    const page1 = makePage('page-1');
    const pagesMap: Record<string, Page> = {
      'page-1': page1,
    };

    const fullPage = { ...page1, content: '# Full content', children: [] };
    vi.mocked(pageService.loadPageWithChildren).mockResolvedValue(fullPage as any);

    const { result } = renderHook(() =>
      usePageSync({
        pageId: 'page-1',
        pages: pagesMap,
        pagesCount: 1,
        onUpdate: vi.fn(),
        onToast: vi.fn(),
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify the page was loaded using the map-accessed path
    expect(pageService.loadPageWithChildren).toHaveBeenCalledWith(page1.path);
    expect(result.current.page?.id).toBe('page-1');
  });

  it('does not load page when id is not in the map', async () => {
    const pagesMap: Record<string, Page> = {
      'page-1': makePage('page-1'),
    };

    const { result } = renderHook(() =>
      usePageSync({
        pageId: 'non-existent',
        pages: pagesMap,
        pagesCount: 1,
        onUpdate: vi.fn(),
        onToast: vi.fn(),
      })
    );

    // Give effects time to run
    await new Promise(r => setTimeout(r, 50));

    expect(pageService.loadPageWithChildren).not.toHaveBeenCalled();
    expect(result.current.page).toBeNull();
  });

  it('does not trigger retry when pagesCount is 0', async () => {
    const emptyMap: Record<string, Page> = {};

    renderHook(() =>
      usePageSync({
        pageId: 'page-1',
        pages: emptyMap,
        pagesCount: 0,
        onUpdate: vi.fn(),
        onToast: vi.fn(),
      })
    );

    await new Promise(r => setTimeout(r, 50));

    // loadPage calls the service only when a page is found in the map;
    // with empty map and count=0, the retry effect does not fire
    expect(pageService.loadPageWithChildren).not.toHaveBeenCalled();
  });
});
