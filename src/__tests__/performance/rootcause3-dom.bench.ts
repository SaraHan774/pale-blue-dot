/**
 * ROOT CAUSE #3 BENCHMARK: Document-Wide Event Handler Overhead
 *
 * Tests the cost of document-level click handlers vs scoped handlers
 * and measures DOM traversal operations.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  benchmark,
  benchmarkWithCounter,
  createBenchmarkSuite,
  formatComparison,
} from './benchmark.utils';

// Setup DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="app">
        <div id="sidebar">
          <button>Menu 1</button>
          <button>Menu 2</button>
        </div>
        <div id="editor-container">
          <div class="editor-content">
            <p>Some text with <a href="https://example.com">external link</a></p>
            <p>More text with <a href="/page/123" data-page-id="123">internal link</a></p>
            <p>Plain text paragraph</p>
            <button>Editor Button</button>
          </div>
        </div>
        <div id="modals">
          <button>Modal Button</button>
        </div>
      </div>
    </body>
  </html>
`, { url: 'https://localhost' });

global.document = dom.window.document as any;
global.HTMLElement = dom.window.HTMLElement as any;

// ============================================================================
// CURRENT IMPLEMENTATION (Document-Wide Handler)
// ============================================================================

class CurrentClickHandler {
  private container: HTMLElement | null = null;
  private operationCount = 0;

  attach() {
    this.container = document.getElementById('editor-container');

    const handler = (e: Event) => {
      this.operationCount++;

      // DOM traversal 1: closest() walks up the tree
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      this.operationCount++;

      if (!link) return;

      // DOM lookup 2: getAttribute
      const href = link.getAttribute('href');
      this.operationCount++;

      if (!href) return;

      // DOM check 3: contains() walks the tree
      if (!this.container || !this.container.contains(link)) return;
      this.operationCount++;

      // DOM check 4: hasAttribute
      if (link.hasAttribute('data-page-ref') || link.hasAttribute('data-page-id')) return;
      this.operationCount += 2;

      // Check URL pattern
      if (href.startsWith('/page/') || href.startsWith('#')) return;

      // External link - open in browser
      e.preventDefault();
    };

    // Capture phase - runs for EVERY click in document
    document.addEventListener('click', handler, true);

    return handler;
  }

  getOperationCount() {
    return this.operationCount;
  }

  resetOperationCount() {
    this.operationCount = 0;
  }
}

// ============================================================================
// OPTIMIZED IMPLEMENTATION (Scoped Handler)
// ============================================================================

class OptimizedClickHandler {
  private container: HTMLElement | null = null;
  private operationCount = 0;

  attach() {
    this.container = document.getElementById('editor-container');

    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      this.operationCount++;

      // Early bailout: check if target is/contains link
      if (target.tagName !== 'A' && !target.querySelector('a')) {
        return; // No DOM traversal needed
      }
      this.operationCount++;

      // Only traverse if potentially a link
      const link = target.tagName === 'A' ? target : target.closest('a[href]');
      this.operationCount++;

      if (!link) return;

      const href = (link as HTMLAnchorElement).getAttribute('href');
      this.operationCount++;

      if (!href) return;

      // Skip internal links
      if (
        (link as HTMLAnchorElement).hasAttribute('data-page-ref') ||
        (link as HTMLAnchorElement).hasAttribute('data-page-id') ||
        href.startsWith('/page/') ||
        href.startsWith('#')
      ) {
        return;
      }
      this.operationCount += 2;

      // External link
      e.preventDefault();
    };

    // Scoped to container - only editor clicks
    this.container?.addEventListener('click', handler, false);

    return handler;
  }

  getOperationCount() {
    return this.operationCount;
  }

  resetOperationCount() {
    this.operationCount = 0;
  }
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

describe('ROOT CAUSE #3: Event Handler Performance', () => {
  it('should measure handler overhead for non-link clicks', async () => {
    const suite = createBenchmarkSuite('Non-Link Click Overhead');

    // Simulate clicking buttons, text, etc. (common case)
    const sidebarButton = document.querySelector('#sidebar button')!;
    const modalButton = document.querySelector('#modals button')!;

    // Current: Document-wide handler
    const currentHandler = new CurrentClickHandler();
    currentHandler.attach();

    const currentResult = await benchmarkWithCounter(
      'Current - Document Handler',
      () => {
        currentHandler.resetOperationCount();

        // 100 clicks outside editor
        for (let i = 0; i < 100; i++) {
          sidebarButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
          modalButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        }

        return { operationCount: currentHandler.getOperationCount() };
      },
      10
    );
    suite.addResult(currentResult);

    // Optimized: Scoped handler
    const optimizedHandler = new OptimizedClickHandler();
    optimizedHandler.attach();

    const optimizedResult = await benchmarkWithCounter(
      'Optimized - Scoped Handler',
      () => {
        optimizedHandler.resetOperationCount();

        // Same clicks - but handler doesn't fire
        for (let i = 0; i < 100; i++) {
          sidebarButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
          modalButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        }

        return { operationCount: optimizedHandler.getOperationCount() };
      },
      10
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    const reduction = ((currentResult.operations - optimizedResult.operations) / currentResult.operations) * 100;
    console.log(`\n📊 DOM Operation Reduction: ${reduction.toFixed(1)}%`);
    console.log(`   Current: ${currentResult.operations.toLocaleString()} operations`);
    console.log(`   Optimized: ${optimizedResult.operations.toLocaleString()} operations\n`);

    expect(optimizedResult.operations).toBe(0); // Handler shouldn't fire at all
  });

  it('should measure handler overhead for link clicks', async () => {
    const suite = createBenchmarkSuite('Link Click Performance');

    const externalLink = document.querySelector('a[href^="https://"]')!;
    const internalLink = document.querySelector('a[data-page-id]')!;

    // Current
    const currentHandler = new CurrentClickHandler();
    currentHandler.attach();

    const currentResult = await benchmarkWithCounter(
      'Current - Link Clicks',
      () => {
        currentHandler.resetOperationCount();

        for (let i = 0; i < 100; i++) {
          externalLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
          internalLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        }

        return { operationCount: currentHandler.getOperationCount() };
      },
      10
    );
    suite.addResult(currentResult);

    // Optimized
    const optimizedHandler = new OptimizedClickHandler();
    optimizedHandler.attach();

    const optimizedResult = await benchmarkWithCounter(
      'Optimized - Link Clicks',
      () => {
        optimizedHandler.resetOperationCount();

        for (let i = 0; i < 100; i++) {
          externalLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
          internalLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        }

        return { operationCount: optimizedHandler.getOperationCount() };
      },
      10
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    const opsReduction = currentResult.operations - optimizedResult.operations;
    console.log(`\n📊 Operations Saved: ${opsReduction.toLocaleString()}\n`);

    expect(optimizedResult.operations).toBeLessThan(currentResult.operations * 0.7);
  });

  it('should measure DOM traversal cost', async () => {
    const suite = createBenchmarkSuite('DOM Traversal Cost');

    // Create deep nesting
    const container = document.getElementById('editor-container')!;
    const deepDiv = document.createElement('div');
    let current = deepDiv;
    for (let i = 0; i < 20; i++) {
      const child = document.createElement('div');
      current.appendChild(child);
      current = child;
    }
    const deepButton = document.createElement('button');
    deepButton.textContent = 'Deep Button';
    current.appendChild(deepButton);
    container.appendChild(deepDiv);

    // Measure closest() traversal
    const closestResult = await benchmark(
      'closest() traversal (20 levels)',
      () => {
        for (let i = 0; i < 1000; i++) {
          deepButton.closest('a[href]'); // Traverses 20 levels up
        }
      },
      10
    );
    suite.addResult(closestResult);

    // Measure contains() check
    const containsResult = await benchmark(
      'contains() check',
      () => {
        for (let i = 0; i < 1000; i++) {
          container.contains(deepButton);
        }
      },
      10
    );
    suite.addResult(containsResult);

    // Measure early bailout optimization
    const bailoutResult = await benchmark(
      'Early bailout (tagName check)',
      () => {
        for (let i = 0; i < 1000; i++) {
          if (deepButton.tagName !== 'A' && !deepButton.querySelector('a')) {
            continue; // Skip expensive traversal
          }
          deepButton.closest('a[href]');
        }
      },
      10
    );
    suite.addResult(bailoutResult);

    suite.print();

    expect(bailoutResult.duration).toBeLessThan(closestResult.duration * 0.5);
  });

  it('should measure real-world click patterns', async () => {
    const suite = createBenchmarkSuite('Real-World Click Pattern');

    // Simulate 100 clicks: 70% outside editor, 20% text, 10% links
    const clicks: HTMLElement[] = [];
    const sidebarBtn = document.querySelector('#sidebar button')! as HTMLElement;
    const editorText = document.querySelector('.editor-content p')! as HTMLElement;
    const link = document.querySelector('.editor-content a')! as HTMLElement;

    for (let i = 0; i < 100; i++) {
      if (i < 70) clicks.push(sidebarBtn);
      else if (i < 90) clicks.push(editorText);
      else clicks.push(link);
    }

    // Current
    const currentHandler = new CurrentClickHandler();
    currentHandler.attach();

    const currentResult = await benchmarkWithCounter(
      'Current - 100 Mixed Clicks',
      () => {
        currentHandler.resetOperationCount();

        clicks.forEach((el) => {
          el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });

        return { operationCount: currentHandler.getOperationCount() };
      },
      100
    );
    suite.addResult(currentResult);

    // Optimized
    const optimizedHandler = new OptimizedClickHandler();
    optimizedHandler.attach();

    const optimizedResult = await benchmarkWithCounter(
      'Optimized - 100 Mixed Clicks',
      () => {
        optimizedHandler.resetOperationCount();

        clicks.forEach((el) => {
          el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });

        return { operationCount: optimizedHandler.getOperationCount() };
      },
      100
    );
    suite.addResult(optimizedResult);

    console.log(formatComparison(currentResult, optimizedResult));

    const avgOpsPerClickCurrent = currentResult.operations / (100 * 100);
    const avgOpsPerClickOptimized = optimizedResult.operations / (100 * 100);

    console.log(`\n📊 Average DOM Operations Per Click:`);
    console.log(`   Current: ${avgOpsPerClickCurrent.toFixed(2)} ops/click`);
    console.log(`   Optimized: ${avgOpsPerClickOptimized.toFixed(2)} ops/click`);
    console.log(`   Reduction: ${((1 - avgOpsPerClickOptimized / avgOpsPerClickCurrent) * 100).toFixed(1)}%\n`);

    expect(optimizedResult.operations).toBeLessThan(currentResult.operations * 0.4);
  });
});
