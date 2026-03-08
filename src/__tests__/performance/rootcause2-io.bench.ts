/**
 * ROOT CAUSE #2 BENCHMARK: Storage Format Write Amplification
 *
 * Tests the I/O overhead of writing full pages vs partial updates
 * and measures write amplification ratio.
 */

import { describe, it, expect } from 'vitest';
import { Page, PageFrontmatter } from '@/types';
import { markdownService } from '@/services/markdown';
import {
  benchmarkWithCounter,
  createBenchmarkSuite,
  formatComparison,
} from './benchmark.utils';
import { generateMockPage, generateMockPages } from './mock-data';

// ============================================================================
// CURRENT IMPLEMENTATION (Full Page Write)
// ============================================================================

class CurrentPageService {
  /**
   * Always writes full page (frontmatter + content)
   */
  async updatePage(page: Page): Promise<{ bytesWritten: number }> {
    const frontmatter: PageFrontmatter = {
      id: page.id,
      title: page.title,
      tags: page.tags,
      createdAt: page.createdAt,
      updatedAt: new Date().toISOString(),
      viewType: page.viewType,
      ...(page.parentId && { parentId: page.parentId }),
      ...(page.dueDate && { dueDate: page.dueDate }),
      ...(page.kanbanColumn && { kanbanColumn: page.kanbanColumn }),
      memos: page.memos || [],
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    const bytesWritten = new Blob([markdown]).size;

    // Simulate write delay (1ms per KB)
    await new Promise((resolve) => setTimeout(resolve, bytesWritten / 1024));

    return { bytesWritten };
  }
}

// ============================================================================
// OPTIMIZED IMPLEMENTATION (Partial Updates)
// ============================================================================

interface PageMetadata {
  id: string;
  title: string;
  tags: string[];
  kanbanColumn?: string;
  dueDate?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  viewType: 'document' | 'kanban';
  memos: any[];
}

class OptimizedPageService {
  /**
   * Separate metadata-only updates
   */
  async updateMetadata(
    _pageId: string,
    metadata: Partial<PageMetadata>
  ): Promise<{ bytesWritten: number }> {
    // Only serialize and write metadata (YAML frontmatter)
    const frontmatterStr = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    const bytesWritten = new Blob([frontmatterStr]).size;

    // Simulate write delay
    await new Promise((resolve) => setTimeout(resolve, bytesWritten / 1024));

    return { bytesWritten };
  }

  /**
   * Full page update (when content changes)
   */
  async updatePage(page: Page): Promise<{ bytesWritten: number }> {
    const frontmatter: PageFrontmatter = {
      id: page.id,
      title: page.title,
      tags: page.tags,
      createdAt: page.createdAt,
      updatedAt: new Date().toISOString(),
      viewType: page.viewType,
      ...(page.parentId && { parentId: page.parentId }),
      ...(page.dueDate && { dueDate: page.dueDate }),
      ...(page.kanbanColumn && { kanbanColumn: page.kanbanColumn }),
      memos: page.memos || [],
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    const bytesWritten = new Blob([markdown]).size;

    await new Promise((resolve) => setTimeout(resolve, bytesWritten / 1024));

    return { bytesWritten };
  }
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

describe('ROOT CAUSE #2: Write Amplification', () => {
  it('should measure metadata-only update overhead', async () => {
    const suite = createBenchmarkSuite('Metadata Update');
    const page = generateMockPage({ content: 'x'.repeat(50000) }); // 50KB content

    const currentService = new CurrentPageService();
    const optimizedService = new OptimizedPageService();

    // Current: Full page write for title change
    const currentResult = await benchmarkWithCounter(
      'Current - Title Change (Full Write)',
      async () => {
        const updatedPage = { ...page, title: 'New Title', updatedAt: new Date().toISOString() };
        const { bytesWritten } = await currentService.updatePage(updatedPage);
        return { operationCount: bytesWritten };
      },
      10
    );
    suite.addResult(currentResult);

    // Optimized: Metadata-only write
    const optimizedResult = await benchmarkWithCounter(
      'Optimized - Title Change (Metadata Only)',
      async () => {
        const { bytesWritten } = await optimizedService.updateMetadata(page.id, {
          title: 'New Title',
          updatedAt: new Date().toISOString(),
        });
        return { operationCount: bytesWritten };
      },
      10
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    // Calculate write amplification ratio
    const amplification = currentResult.operations / optimizedResult.operations;
    console.log(`\n📊 Write Amplification Ratio: ${amplification.toFixed(1)}x`);
    console.log(`   Current: ${currentResult.operations.toLocaleString()} bytes`);
    console.log(`   Optimized: ${optimizedResult.operations.toLocaleString()} bytes`);
    console.log(`   Saved: ${(currentResult.operations - optimizedResult.operations).toLocaleString()} bytes\n`);

    expect(amplification).toBeGreaterThan(100); // Should be massive
  });

  it('should measure column change overhead', async () => {
    const suite = createBenchmarkSuite('Column Change');
    const page = generateMockPage({ content: 'x'.repeat(100000) }); // 100KB

    const currentService = new CurrentPageService();
    const optimizedService = new OptimizedPageService();

    // Current
    const currentResult = await benchmarkWithCounter(
      'Current - Column Change',
      async () => {
        const updated = { ...page, kanbanColumn: 'In Progress' };
        const { bytesWritten } = await currentService.updatePage(updated);
        return { operationCount: bytesWritten };
      },
      5
    );
    suite.addResult(currentResult);

    // Optimized
    const optimizedResult = await benchmarkWithCounter(
      'Optimized - Column Change',
      async () => {
        const { bytesWritten } = await optimizedService.updateMetadata(page.id, {
          kanbanColumn: 'In Progress',
        });
        return { operationCount: bytesWritten };
      },
      5
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    const amplification = currentResult.operations / optimizedResult.operations;
    expect(amplification).toBeGreaterThan(1000); // Even worse for small changes
  });

  it('should measure multi-field metadata update', async () => {
    const suite = createBenchmarkSuite('Multi-Field Update');
    const page = generateMockPage({ content: 'x'.repeat(75000) }); // 75KB

    const currentService = new CurrentPageService();
    const optimizedService = new OptimizedPageService();

    // Simulate user editing: title → column → tag1 → tag2 → due date
    const updates = [
      { title: 'Updated Title' },
      { kanbanColumn: 'Done' },
      { tags: [...page.tags, 'urgent'] },
      { tags: [...page.tags, 'urgent', 'bug'] },
      { dueDate: '2026-03-15' },
    ];

    // Current: 5 separate full writes
    const currentResult = await benchmarkWithCounter(
      'Current - 5 Metadata Changes (5 Full Writes)',
      async () => {
        let totalBytes = 0;
        let updatedPage = { ...page };

        for (const update of updates) {
          updatedPage = { ...updatedPage, ...update, updatedAt: new Date().toISOString() };
          const { bytesWritten } = await currentService.updatePage(updatedPage);
          totalBytes += bytesWritten;
        }

        return { operationCount: totalBytes };
      },
      3
    );
    suite.addResult(currentResult);

    // Optimized: 5 small metadata writes
    const optimizedResult = await benchmarkWithCounter(
      'Optimized - 5 Metadata Changes (5 Partial Writes)',
      async () => {
        let totalBytes = 0;

        for (const update of updates) {
          const { bytesWritten } = await optimizedService.updateMetadata(page.id, update);
          totalBytes += bytesWritten;
        }

        return { operationCount: totalBytes };
      },
      3
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    const totalAmplification = currentResult.operations / optimizedResult.operations;
    console.log(`\n📊 Total I/O Comparison (5 updates):`);
    console.log(`   Current: ${(currentResult.operations / 1024).toFixed(1)} KB`);
    console.log(`   Optimized: ${(optimizedResult.operations / 1024).toFixed(1)} KB`);
    console.log(`   Amplification: ${totalAmplification.toFixed(1)}x`);
    console.log(`   Savings: ${((currentResult.operations - optimizedResult.operations) / 1024).toFixed(1)} KB\n`);

    expect(totalAmplification).toBeGreaterThan(500);
  });

  it('should measure serialization overhead by content size', async () => {
    const suite = createBenchmarkSuite('Serialization Scaling');
    const sizes = [1000, 5000, 10000, 50000, 100000]; // 1KB to 100KB

    for (const size of sizes) {
      const page = generateMockPage({ content: 'x'.repeat(size) });
      const service = new CurrentPageService();

      const result = await benchmarkWithCounter(
        `Serialize ${(size / 1000).toFixed(0)}KB page`,
        async () => {
          const updated = { ...page, title: 'Updated' };
          const { bytesWritten } = await service.updatePage(updated);
          return { operationCount: bytesWritten };
        },
        10
      );

      result.metadata = {
        ...result.metadata,
        contentSize: size,
        bytesPerOp: Math.round(result.operations / 10),
      };

      suite.addResult(result);
    }

    suite.print();
  });

  it('should measure batched vs unbatched updates', async () => {
    const suite = createBenchmarkSuite('Batched Updates');
    const pages = generateMockPages(20, { contentSize: 30000 });

    const currentService = new CurrentPageService();
    const optimizedService = new OptimizedPageService();

    // Current: 20 individual writes
    const currentResult = await benchmarkWithCounter(
      'Current - 20 Sequential Writes',
      async () => {
        let totalBytes = 0;

        for (const page of pages) {
          const updated = { ...page, title: 'Updated', updatedAt: new Date().toISOString() };
          const { bytesWritten } = await currentService.updatePage(updated);
          totalBytes += bytesWritten;
        }

        return { operationCount: totalBytes };
      },
      1
    );
    suite.addResult(currentResult);

    // Optimized: 20 metadata-only writes (could be batched further)
    const optimizedResult = await benchmarkWithCounter(
      'Optimized - 20 Metadata Updates',
      async () => {
        let totalBytes = 0;

        for (const page of pages) {
          const { bytesWritten } = await optimizedService.updateMetadata(page.id, {
            title: 'Updated',
          });
          totalBytes += bytesWritten;
        }

        return { operationCount: totalBytes };
      },
      1
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    const savingsKB = (currentResult.operations - optimizedResult.operations) / 1024;
    console.log(`\n💾 I/O Savings: ${savingsKB.toFixed(1)} KB\n`);

    expect(optimizedResult.operations).toBeLessThan(currentResult.operations * 0.01);
  });
});
