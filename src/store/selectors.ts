/**
 * Zustand State Selectors
 * Efficient selectors for normalized page state
 */

import { Page } from '@/types';

/**
 * Normalized state structure (future)
 */
export interface NormalizedPageState {
  pages: Record<string, Page>;
  pageIds: string[];
  indexes: {
    columnIndex: Record<string, Set<string>>;
    tagIndex: Record<string, Set<string>>;
    parentIndex: Record<string, Set<string>>;
  };
}

/**
 * Current state structure (for migration compatibility)
 */
export interface CurrentPageState {
  pages: Page[];
}

/**
 * Select a single page by ID
 *
 * @example
 * const page = useStore(state => selectPage(state, pageId));
 */
export function selectPage(
  state: CurrentPageState | NormalizedPageState,
  pageId: string
): Page | undefined {
  // Handle normalized state
  if ('pageIds' in state) {
    return state.pages[pageId];
  }

  // Handle current flat array state
  return (state.pages as Page[]).find(p => p.id === pageId);
}

/**
 * Select all pages in a specific column
 *
 * @example
 * const todoPages = useStore(state => selectPagesByColumn(state, 'To Do'));
 */
export function selectPagesByColumn(
  state: CurrentPageState | NormalizedPageState,
  column: string
): Page[] {
  // Handle normalized state with index
  if ('pageIds' in state) {
    const pageIds = state.indexes.columnIndex[column.toLowerCase()];
    if (!pageIds) return [];
    return Array.from(pageIds).map(id => state.pages[id]).filter(Boolean);
  }

  // Handle current flat array state
  return (state.pages as Page[]).filter(p => p.kanbanColumn === column);
}

/**
 * Select all pages with a specific tag
 *
 * @example
 * const urgentPages = useStore(state => selectPagesByTag(state, 'urgent'));
 */
export function selectPagesByTag(
  state: CurrentPageState | NormalizedPageState,
  tag: string
): Page[] {
  // Handle normalized state with index
  if ('pageIds' in state) {
    const pageIds = state.indexes.tagIndex[tag.toLowerCase()];
    if (!pageIds) return [];
    return Array.from(pageIds).map(id => state.pages[id]).filter(Boolean);
  }

  // Handle current flat array state
  return (state.pages as Page[]).filter(p => p.tags.includes(tag));
}

/**
 * Select all unique columns
 *
 * @example
 * const columns = useStore(selectAllColumns);
 */
export function selectAllColumns(
  state: CurrentPageState | NormalizedPageState
): string[] {
  // Handle normalized state with index
  if ('pageIds' in state) {
    return Object.keys(state.indexes.columnIndex);
  }

  // Handle current flat array state
  const columns = (state.pages as Page[])
    .map(p => p.kanbanColumn)
    .filter(Boolean) as string[];
  return Array.from(new Set(columns));
}

/**
 * Select all unique tags
 *
 * @example
 * const allTags = useStore(selectAllTags);
 */
export function selectAllTags(
  state: CurrentPageState | NormalizedPageState
): string[] {
  // Handle normalized state with index
  if ('pageIds' in state) {
    return Object.keys(state.indexes.tagIndex);
  }

  // Handle current flat array state
  const tags = (state.pages as Page[]).flatMap(p => p.tags);
  return Array.from(new Set(tags));
}

/**
 * Select child pages of a parent
 *
 * @example
 * const children = useStore(state => selectChildPages(state, parentId));
 */
export function selectChildPages(
  state: CurrentPageState | NormalizedPageState,
  parentId: string
): Page[] {
  // Handle normalized state with index
  if ('pageIds' in state) {
    const pageIds = state.indexes.parentIndex[parentId];
    if (!pageIds) return [];
    return Array.from(pageIds).map(id => state.pages[id]).filter(Boolean);
  }

  // Handle current flat array state
  return (state.pages as Page[]).filter(p => p.parentId === parentId);
}

/**
 * Select root pages (no parent)
 *
 * @example
 * const rootPages = useStore(selectRootPages);
 */
export function selectRootPages(
  state: CurrentPageState | NormalizedPageState
): Page[] {
  // Handle normalized state
  if ('pageIds' in state) {
    return state.pageIds
      .map(id => state.pages[id])
      .filter(p => p && !p.parentId);
  }

  // Handle current flat array state
  return (state.pages as Page[]).filter(p => !p.parentId);
}

/**
 * Count pages by column
 *
 * @example
 * const counts = useStore(selectPageCountByColumn);
 * // { "To Do": 5, "In Progress": 3, "Done": 10 }
 */
export function selectPageCountByColumn(
  state: CurrentPageState | NormalizedPageState
): Record<string, number> {
  // Handle normalized state
  if ('pageIds' in state) {
    const counts: Record<string, number> = {};
    Object.entries(state.indexes.columnIndex).forEach(([column, pageIds]) => {
      counts[column] = pageIds.size;
    });
    return counts;
  }

  // Handle current flat array state
  const counts: Record<string, number> = {};
  (state.pages as Page[]).forEach(p => {
    if (p.kanbanColumn) {
      counts[p.kanbanColumn] = (counts[p.kanbanColumn] || 0) + 1;
    }
  });
  return counts;
}

/**
 * Select pages matching search text
 *
 * @example
 * const results = useStore(state => selectPagesBySearch(state, 'bug fix'));
 */
export function selectPagesBySearch(
  state: CurrentPageState | NormalizedPageState,
  searchText: string
): Page[] {
  const lowerSearch = searchText.toLowerCase();

  // Get all pages
  const allPages = 'pageIds' in state
    ? state.pageIds.map(id => state.pages[id])
    : (state.pages as Page[]);

  return allPages.filter(page =>
    page.title.toLowerCase().includes(lowerSearch) ||
    page.content.toLowerCase().includes(lowerSearch) ||
    page.tags.some(tag => tag.toLowerCase().includes(lowerSearch))
  );
}
