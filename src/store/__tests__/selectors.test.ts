/**
 * Tests for Zustand state selectors
 * Verifies that selectAllColumns and selectAllTags return original-case values
 * even though the internal indexes use lowercase keys.
 */

import { describe, it, expect } from 'vitest';
import { buildNormalizedState } from '../normalizedHelpers';
import { selectAllColumns, selectAllTags } from '../selectors';
import type { Page } from '@/types';

function makePage(overrides: Partial<Page>): Page {
  return {
    id: 'default-id',
    title: 'Default Title',
    content: '',
    tags: [],
    kanbanColumn: undefined,
    parentId: undefined,
    viewType: 'document',
    pinned: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Page;
}

describe('selectAllColumns (normalized state)', () => {
  it('returns original-case column names, not lowercased index keys', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', kanbanColumn: 'To Do' }),
      makePage({ id: 'p2', kanbanColumn: 'In Progress' }),
      makePage({ id: 'p3', kanbanColumn: 'Done' }),
    ];

    const state = buildNormalizedState(pages);
    const columns = selectAllColumns(state);

    // Must return original case
    expect(columns).toContain('To Do');
    expect(columns).toContain('In Progress');
    expect(columns).toContain('Done');

    // Must NOT return lowercased versions
    expect(columns).not.toContain('to do');
    expect(columns).not.toContain('in progress');
    expect(columns).not.toContain('done');

    expect(columns).toHaveLength(3);
  });

  it('deduplicates columns', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', kanbanColumn: 'To Do' }),
      makePage({ id: 'p2', kanbanColumn: 'To Do' }),
      makePage({ id: 'p3', kanbanColumn: 'Done' }),
    ];

    const state = buildNormalizedState(pages);
    const columns = selectAllColumns(state);

    expect(columns).toHaveLength(2);
    expect(columns).toContain('To Do');
    expect(columns).toContain('Done');
  });

  it('omits pages with no kanbanColumn', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', kanbanColumn: 'To Do' }),
      makePage({ id: 'p2', kanbanColumn: undefined }),
    ];

    const state = buildNormalizedState(pages);
    const columns = selectAllColumns(state);

    expect(columns).toHaveLength(1);
    expect(columns).toContain('To Do');
  });

  it('returns empty array when no pages have columns', () => {
    const pages: Page[] = [makePage({ id: 'p1', kanbanColumn: undefined })];

    const state = buildNormalizedState(pages);
    const columns = selectAllColumns(state);

    expect(columns).toHaveLength(0);
  });
});

describe('selectAllTags (normalized state)', () => {
  it('returns original-case tag values, not lowercased index keys', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', tags: ['TypeScript', 'React'] }),
      makePage({ id: 'p2', tags: ['Vue', 'JavaScript'] }),
    ];

    const state = buildNormalizedState(pages);
    const tags = selectAllTags(state);

    // Must return original case
    expect(tags).toContain('TypeScript');
    expect(tags).toContain('React');
    expect(tags).toContain('Vue');
    expect(tags).toContain('JavaScript');

    // Must NOT return lowercased versions
    expect(tags).not.toContain('typescript');
    expect(tags).not.toContain('react');
    expect(tags).not.toContain('vue');
    expect(tags).not.toContain('javascript');

    expect(tags).toHaveLength(4);
  });

  it('deduplicates tags across pages', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', tags: ['TypeScript', 'React'] }),
      makePage({ id: 'p2', tags: ['TypeScript', 'Vue'] }),
    ];

    const state = buildNormalizedState(pages);
    const tags = selectAllTags(state);

    expect(tags).toHaveLength(3);
    expect(tags).toContain('TypeScript');
    expect(tags).toContain('React');
    expect(tags).toContain('Vue');
  });

  it('returns empty array when no pages have tags', () => {
    const pages: Page[] = [makePage({ id: 'p1', tags: [] })];

    const state = buildNormalizedState(pages);
    const tags = selectAllTags(state);

    expect(tags).toHaveLength(0);
  });
});

describe('selectAllColumns (flat array state)', () => {
  it('returns columns from flat array state', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', kanbanColumn: 'To Do' }),
      makePage({ id: 'p2', kanbanColumn: 'Done' }),
    ];

    const columns = selectAllColumns({ pages });

    expect(columns).toContain('To Do');
    expect(columns).toContain('Done');
    expect(columns).toHaveLength(2);
  });
});

describe('selectAllTags (flat array state)', () => {
  it('returns tags from flat array state', () => {
    const pages: Page[] = [
      makePage({ id: 'p1', tags: ['TypeScript'] }),
      makePage({ id: 'p2', tags: ['React'] }),
    ];

    const tags = selectAllTags({ pages });

    expect(tags).toContain('TypeScript');
    expect(tags).toContain('React');
    expect(tags).toHaveLength(2);
  });
});
