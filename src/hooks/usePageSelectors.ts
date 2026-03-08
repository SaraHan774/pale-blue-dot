/**
 * Custom hooks for efficient page state access
 * Uses Zustand selectors with shallow equality checks
 */

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Page } from '@/types';
import {
  selectPage,
  selectPagesByColumn,
  selectPagesByTag,
  selectAllColumns,
  selectAllTags,
  selectChildPages,
  selectRootPages,
  selectPageCountByColumn,
  selectPagesBySearch,
  selectRecentlyEditedPages,
} from '@/store/selectors';

/**
 * Hook to get a single page by ID
 * Only re-renders when the specific page changes
 *
 * @example
 * const page = usePageById(pageId);
 */
export function usePageById(pageId: string): Page | undefined {
  return useStore(state => selectPage(state, pageId));
}

/**
 * Hook to get all pages in a column
 * Only re-renders when pages in this column change
 *
 * @example
 * const todoPages = usePagesByColumn('To Do');
 */
export function usePagesByColumn(column: string): Page[] {
  return useStore(state => selectPagesByColumn(state, column));
}

/**
 * Hook to get all pages with a specific tag
 * Only re-renders when pages with this tag change
 *
 * @example
 * const urgentPages = usePagesByTag('urgent');
 */
export function usePagesByTag(tag: string): Page[] {
  return useStore(state => selectPagesByTag(state, tag));
}

/**
 * Hook to get all unique columns
 * Only re-renders when the column list changes
 *
 * @example
 * const columns = useColumnList();
 */
export function useColumnList(): string[] {
  return useStore(selectAllColumns);
}

/**
 * Hook to get all unique tags
 * Only re-renders when the tag list changes
 *
 * @example
 * const tags = useTagList();
 */
export function useTagList(): string[] {
  return useStore(selectAllTags);
}

/**
 * Hook to get child pages of a parent
 * Only re-renders when the children change
 *
 * @example
 * const children = useChildPages(parentId);
 */
export function useChildPages(parentId: string): Page[] {
  return useStore(state => selectChildPages(state, parentId));
}

/**
 * Hook to get root pages (no parent)
 * Only re-renders when root pages change
 *
 * @example
 * const rootPages = useRootPages();
 */
export function useRootPages(): Page[] {
  return useStore(selectRootPages);
}

/**
 * Hook to get page counts by column
 * Returns { "To Do": 5, "In Progress": 3, "Done": 10 }
 *
 * @example
 * const counts = usePageCountsByColumn();
 */
export function usePageCountsByColumn(): Record<string, number> {
  return useStore(selectPageCountByColumn);
}

/**
 * Hook to search pages by text
 * Memoized to prevent unnecessary re-renders
 *
 * @example
 * const results = usePageSearch('bug fix');
 */
export function usePageSearch(searchText: string): Page[] {
  const pages = useStore(state => state.pagesArray);

  return useMemo(() => {
    if (!searchText.trim()) return [];
    return selectPagesBySearch({ pages }, searchText);
  }, [pages, searchText]);
}

/**
 * Hook to get filtered pages by multiple criteria
 * Only re-renders when filtered results change
 *
 * @example
 * const filtered = useFilteredPages({
 *   column: 'To Do',
 *   tags: ['urgent', 'bug'],
 *   searchText: 'fix'
 * });
 */
export function useFilteredPages(filters: {
  column?: string;
  tags?: string[];
  searchText?: string;
}): Page[] {
  const pages = useStore(state => state.pagesArray);

  return useMemo(() => {
    let allPages = 'pageIds' in pages
      ? (pages as any).pageIds.map((id: string) => (pages as any).pages[id])
      : (pages as Page[]);

    // Filter by column
    if (filters.column) {
      allPages = allPages.filter((p: Page) => p.kanbanColumn === filters.column);
    }

    // Filter by tags (pages must have ALL specified tags)
    if (filters.tags && filters.tags.length > 0) {
      allPages = allPages.filter((p: Page) =>
        filters.tags!.every(tag => p.tags.includes(tag))
      );
    }

    // Filter by search text
    if (filters.searchText && filters.searchText.trim()) {
      const lowerSearch = filters.searchText.toLowerCase();
      allPages = allPages.filter((p: Page) =>
        p.title.toLowerCase().includes(lowerSearch) ||
        p.content.toLowerCase().includes(lowerSearch) ||
        p.tags.some(tag => tag.toLowerCase().includes(lowerSearch))
      );
    }

    return allPages;
  }, [pages, filters.column, filters.tags, filters.searchText]);
}

/**
 * Hook to get sorted columns with stable color assignment
 * Memoized to prevent recalculation on every render
 *
 * @example
 * const sortedColumns = useSortedColumns();
 */
export function useSortedColumns(): string[] {
  const columns = useColumnList();

  return useMemo(() => {
    return [...columns].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [columns]);
}

/**
 * Hook to get recently edited pages
 * Only re-renders when recently edited pages change
 *
 * @example
 * const recentPages = useRecentlyEditedPages(5, currentPageId);
 */
export function useRecentlyEditedPages(limit: number, excludeId?: string): Page[] {
  return useStore(state => selectRecentlyEditedPages(state, limit, excludeId));
}
