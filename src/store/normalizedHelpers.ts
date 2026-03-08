/**
 * Helper functions for managing normalized page state and indexes
 */

import { Page } from '@/types';

export interface PageIndexes {
  columnIndex: Record<string, Set<string>>;
  tagIndex: Record<string, Set<string>>;
  parentIndex: Record<string, Set<string>>;
}

export interface NormalizedPages {
  pages: Record<string, Page>;
  pageIds: string[];
  indexes: PageIndexes;
}

/**
 * Build normalized state from flat array of pages
 */
export function buildNormalizedState(pages: Page[]): NormalizedPages {
  const normalized: NormalizedPages = {
    pages: {},
    pageIds: [],
    indexes: {
      columnIndex: {},
      tagIndex: {},
      parentIndex: {},
    },
  };

  pages.forEach(page => {
    normalized.pages[page.id] = page;
    normalized.pageIds.push(page.id);
    addPageToIndexes(normalized.indexes, page);
  });

  return normalized;
}

/**
 * Add a page to all indexes
 */
export function addPageToIndexes(indexes: PageIndexes, page: Page): void {
  // Add to column index
  if (page.kanbanColumn) {
    const key = page.kanbanColumn.toLowerCase();
    if (!indexes.columnIndex[key]) {
      indexes.columnIndex[key] = new Set();
    }
    indexes.columnIndex[key].add(page.id);
  }

  // Add to tag indexes
  page.tags.forEach(tag => {
    const key = tag.toLowerCase();
    if (!indexes.tagIndex[key]) {
      indexes.tagIndex[key] = new Set();
    }
    indexes.tagIndex[key].add(page.id);
  });

  // Add to parent index
  if (page.parentId) {
    if (!indexes.parentIndex[page.parentId]) {
      indexes.parentIndex[page.parentId] = new Set();
    }
    indexes.parentIndex[page.parentId].add(page.id);
  }
}

/**
 * Remove a page from all indexes
 */
export function removePageFromIndexes(indexes: PageIndexes, page: Page): void {
  // Remove from column index
  if (page.kanbanColumn) {
    const key = page.kanbanColumn.toLowerCase();
    indexes.columnIndex[key]?.delete(page.id);
    if (indexes.columnIndex[key]?.size === 0) {
      delete indexes.columnIndex[key];
    }
  }

  // Remove from tag indexes
  page.tags.forEach(tag => {
    const key = tag.toLowerCase();
    indexes.tagIndex[key]?.delete(page.id);
    if (indexes.tagIndex[key]?.size === 0) {
      delete indexes.tagIndex[key];
    }
  });

  // Remove from parent index
  if (page.parentId) {
    indexes.parentIndex[page.parentId]?.delete(page.id);
    if (indexes.parentIndex[page.parentId]?.size === 0) {
      delete indexes.parentIndex[page.parentId];
    }
  }
}

/**
 * Update indexes when a page changes
 * Efficiently handles only the changed fields
 */
export function updatePageInIndexes(
  indexes: PageIndexes,
  oldPage: Page,
  newPage: Page
): void {
  // Update column index if changed
  if (oldPage.kanbanColumn !== newPage.kanbanColumn) {
    // Remove from old column
    if (oldPage.kanbanColumn) {
      const oldKey = oldPage.kanbanColumn.toLowerCase();
      indexes.columnIndex[oldKey]?.delete(newPage.id);
      if (indexes.columnIndex[oldKey]?.size === 0) {
        delete indexes.columnIndex[oldKey];
      }
    }

    // Add to new column
    if (newPage.kanbanColumn) {
      const newKey = newPage.kanbanColumn.toLowerCase();
      if (!indexes.columnIndex[newKey]) {
        indexes.columnIndex[newKey] = new Set();
      }
      indexes.columnIndex[newKey].add(newPage.id);
    }
  }

  // Update tag indexes if changed
  const oldTags = new Set(oldPage.tags.map(t => t.toLowerCase()));
  const newTags = new Set(newPage.tags.map(t => t.toLowerCase()));

  // Remove old tags
  oldPage.tags.forEach(tag => {
    const key = tag.toLowerCase();
    if (!newTags.has(key)) {
      indexes.tagIndex[key]?.delete(newPage.id);
      if (indexes.tagIndex[key]?.size === 0) {
        delete indexes.tagIndex[key];
      }
    }
  });

  // Add new tags
  newPage.tags.forEach(tag => {
    const key = tag.toLowerCase();
    if (!oldTags.has(key)) {
      if (!indexes.tagIndex[key]) {
        indexes.tagIndex[key] = new Set();
      }
      indexes.tagIndex[key].add(newPage.id);
    }
  });

  // Update parent index if changed
  if (oldPage.parentId !== newPage.parentId) {
    // Remove from old parent
    if (oldPage.parentId) {
      indexes.parentIndex[oldPage.parentId]?.delete(newPage.id);
      if (indexes.parentIndex[oldPage.parentId]?.size === 0) {
        delete indexes.parentIndex[oldPage.parentId];
      }
    }

    // Add to new parent
    if (newPage.parentId) {
      if (!indexes.parentIndex[newPage.parentId]) {
        indexes.parentIndex[newPage.parentId] = new Set();
      }
      indexes.parentIndex[newPage.parentId].add(newPage.id);
    }
  }
}

/**
 * Convert normalized state back to flat array
 * Used for backward compatibility
 */
export function denormalizePages(normalized: NormalizedPages): Page[] {
  return normalized.pageIds.map(id => normalized.pages[id]).filter(Boolean);
}
