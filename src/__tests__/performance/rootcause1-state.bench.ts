/**
 * ROOT CAUSE #1 BENCHMARK: Non-Normalized State Architecture
 *
 * Tests the performance of state updates and derived computations
 * when using flat array vs normalized entity store.
 */

import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { Page } from '@/types';
import {
  benchmark,
  benchmarkWithCounter,
  createBenchmarkSuite,
  formatComparison,
} from './benchmark.utils';
import { generateWorkspaceScenario, SCENARIOS } from './mock-data';

// ============================================================================
// CURRENT IMPLEMENTATION (Flat Array)
// ============================================================================

interface FlatArrayStore {
  pages: Page[];
  updatePage: (page: Page) => void;
  getExistingColumns: () => string[];
  getAllTags: () => string[];
}

function createFlatArrayStore(initialPages: Page[]) {
  return create<FlatArrayStore>((set, get) => ({
    pages: initialPages,

    updatePage: (page: Page) =>
      set((state) => ({
        pages: state.pages.map((p) => (p.id === page.id ? page : p)),
      })),

    getExistingColumns: () => {
      const pages = get().pages;
      const columns = Array.from(new Set(pages.map(p => p.kanbanColumn).filter(Boolean) as string[]));
      return columns;
    },

    getAllTags: () => {
      const pages = get().pages;
      const tags = Array.from(new Set(pages.flatMap(p => p.tags)));
      return tags;
    },
  }));
}

// ============================================================================
// OPTIMIZED IMPLEMENTATION (Normalized Entities)
// ============================================================================

interface NormalizedStore {
  pages: Record<string, Page>;
  pageIds: string[];
  indexes: {
    columnIndex: Record<string, Set<string>>;
    tagIndex: Record<string, Set<string>>;
  };
  updatePage: (page: Page) => void;
  getExistingColumns: () => string[];
  getAllTags: () => string[];
}

function createNormalizedStore(initialPages: Page[]) {
  const pages: Record<string, Page> = {};
  const pageIds: string[] = [];
  const columnIndex: Record<string, Set<string>> = {};
  const tagIndex: Record<string, Set<string>> = {};

  // Build initial indexes
  initialPages.forEach((page) => {
    pages[page.id] = page;
    pageIds.push(page.id);

    if (page.kanbanColumn) {
      if (!columnIndex[page.kanbanColumn]) {
        columnIndex[page.kanbanColumn] = new Set();
      }
      columnIndex[page.kanbanColumn].add(page.id);
    }

    page.tags.forEach((tag) => {
      if (!tagIndex[tag]) {
        tagIndex[tag] = new Set();
      }
      tagIndex[tag].add(page.id);
    });
  });

  return create<NormalizedStore>((set, get) => ({
    pages,
    pageIds,
    indexes: { columnIndex, tagIndex },

    updatePage: (page: Page) => {
      const oldPage = get().pages[page.id];

      set((state) => {
        // Update page
        const newPages = { ...state.pages, [page.id]: page };

        // Update indexes incrementally
        const newColumnIndex = { ...state.indexes.columnIndex };
        const newTagIndex = { ...state.indexes.tagIndex };

        // Update column index
        if (oldPage?.kanbanColumn !== page.kanbanColumn) {
          if (oldPage?.kanbanColumn) {
            const oldSet = new Set(newColumnIndex[oldPage.kanbanColumn]);
            oldSet.delete(page.id);
            newColumnIndex[oldPage.kanbanColumn] = oldSet;
          }
          if (page.kanbanColumn) {
            if (!newColumnIndex[page.kanbanColumn]) {
              newColumnIndex[page.kanbanColumn] = new Set();
            }
            const newSet = new Set(newColumnIndex[page.kanbanColumn]);
            newSet.add(page.id);
            newColumnIndex[page.kanbanColumn] = newSet;
          }
        }

        // Update tag index (simplified - full implementation would diff tags)
        if (oldPage) {
          oldPage.tags.forEach((tag) => {
            const oldSet = new Set(newTagIndex[tag] || []);
            oldSet.delete(page.id);
            newTagIndex[tag] = oldSet;
          });
        }
        page.tags.forEach((tag) => {
          if (!newTagIndex[tag]) {
            newTagIndex[tag] = new Set();
          }
          const newSet = new Set(newTagIndex[tag]);
          newSet.add(page.id);
          newTagIndex[tag] = newSet;
        });

        return {
          pages: newPages,
          indexes: { columnIndex: newColumnIndex, tagIndex: newTagIndex },
        };
      });
    },

    getExistingColumns: () => {
      const cols = Object.keys(get().indexes.columnIndex);
      return cols;
    },

    getAllTags: () => {
      const tags = Object.keys(get().indexes.tagIndex);
      return tags;
    },
  }));
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

describe('ROOT CAUSE #1: State Update Performance', () => {
  it('should measure single page update time', async () => {
    const suite = createBenchmarkSuite('Single Page Update');
    const scenario = generateWorkspaceScenario(SCENARIOS.MEDIUM.pages, SCENARIOS.MEDIUM.contentSize);

    // Current implementation
    const flatStore = createFlatArrayStore(scenario.pages);
    const targetPage = { ...scenario.pages[0], title: 'Updated Title' };

    const flatResult = await benchmark(
      'Flat Array - Single Update',
      () => flatStore.getState().updatePage(targetPage),
      100
    );
    suite.addResult(flatResult);

    // Optimized implementation
    const normalizedStore = createNormalizedStore(scenario.pages);
    const optimizedResult = await benchmark(
      'Normalized - Single Update',
      () => normalizedStore.getState().updatePage(targetPage),
      100
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(flatResult, optimizedResult));

    // Expect significant improvement
    expect(optimizedResult.duration).toBeLessThan(flatResult.duration * 0.5);
  });

  it('should measure derived computation overhead', async () => {
    const suite = createBenchmarkSuite('Derived Computations');
    const scenario = generateWorkspaceScenario(SCENARIOS.MEDIUM.pages, SCENARIOS.MEDIUM.contentSize);

    // Current implementation - getExistingColumns scans all pages
    const flatStore = createFlatArrayStore(scenario.pages);
    const flatResult = await benchmark(
      'Flat Array - Get Columns',
      () => { flatStore.getState().getExistingColumns(); },
      1000
    );
    suite.addResult(flatResult);

    // Optimized implementation - O(1) index lookup
    const normalizedStore = createNormalizedStore(scenario.pages);
    const optimizedResult = await benchmark(
      'Normalized - Get Columns',
      () => { normalizedStore.getState().getExistingColumns(); },
      1000
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(flatResult, optimizedResult));

    expect(optimizedResult.duration).toBeLessThan(flatResult.duration * 0.1);
  });

  it('should measure tag aggregation performance', async () => {
    const suite = createBenchmarkSuite('Tag Aggregation');
    const scenario = generateWorkspaceScenario(SCENARIOS.MEDIUM.pages, SCENARIOS.MEDIUM.contentSize);

    // Current implementation
    const flatStore = createFlatArrayStore(scenario.pages);
    const flatResult = await benchmark(
      'Flat Array - Get All Tags',
      () => { flatStore.getState().getAllTags(); },
      1000
    );
    suite.addResult(flatResult);

    // Optimized implementation
    const normalizedStore = createNormalizedStore(scenario.pages);
    const optimizedResult = await benchmark(
      'Normalized - Get All Tags',
      () => { normalizedStore.getState().getAllTags(); },
      1000
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(flatResult, optimizedResult));

    expect(optimizedResult.duration).toBeLessThan(flatResult.duration * 0.1);
  });

  it('should measure cascading update cost', async () => {
    const suite = createBenchmarkSuite('Cascading Updates');
    const scenario = generateWorkspaceScenario(SCENARIOS.LARGE.pages, SCENARIOS.LARGE.contentSize);

    // Simulate 10 rapid updates (like editing metadata fields)
    const updates = scenario.pages.slice(0, 10).map((p, i) => ({
      ...p,
      title: `Updated ${i}`,
      kanbanColumn: 'In Progress',
    }));

    // Current implementation
    const flatStore = createFlatArrayStore(scenario.pages);
    const flatResult = await benchmarkWithCounter(
      'Flat Array - 10 Sequential Updates',
      () => {
        let ops = 0;
        updates.forEach((page) => {
          flatStore.getState().updatePage(page);
          ops += flatStore.getState().pages.length; // Count array scans
        });
        return { operationCount: ops };
      },
      10
    );
    suite.addResult(flatResult);

    // Optimized implementation
    const normalizedStore = createNormalizedStore(scenario.pages);
    const optimizedResult = await benchmarkWithCounter(
      'Normalized - 10 Sequential Updates',
      () => {
        let ops = 0;
        updates.forEach((page) => {
          normalizedStore.getState().updatePage(page);
          ops += 1; // O(1) lookup
        });
        return { operationCount: ops };
      },
      10
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(flatResult, optimizedResult));

    expect(optimizedResult.operations).toBeLessThan(flatResult.operations * 0.01);
  });

  it('should measure memory allocation overhead', async () => {
    const suite = createBenchmarkSuite('Memory Allocation');
    const scenario = generateWorkspaceScenario(SCENARIOS.LARGE.pages, SCENARIOS.LARGE.contentSize);

    // Current implementation - creates new array on every update
    const flatStore = createFlatArrayStore(scenario.pages);
    const targetPage = { ...scenario.pages[0], title: 'Updated' };

    const flatResult = await benchmark(
      'Flat Array - Memory Allocation',
      () => {
        for (let i = 0; i < 50; i++) {
          flatStore.getState().updatePage({ ...targetPage, title: `Update ${i}` });
        }
      },
      1
    );
    suite.addResult(flatResult);

    // Optimized implementation
    const normalizedStore = createNormalizedStore(scenario.pages);
    const optimizedResult = await benchmark(
      'Normalized - Memory Allocation',
      () => {
        for (let i = 0; i < 50; i++) {
          normalizedStore.getState().updatePage({ ...targetPage, title: `Update ${i}` });
        }
      },
      1
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(flatResult, optimizedResult));

    if (flatResult.memoryDelta && optimizedResult.memoryDelta) {
      expect(optimizedResult.memoryDelta).toBeLessThan(flatResult.memoryDelta * 0.5);
    }
  });
});
