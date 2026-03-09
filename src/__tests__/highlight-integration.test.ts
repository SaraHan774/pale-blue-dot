/**
 * Integration test for highlight operations
 * Verifies that highlight operations work correctly with inline <mark> storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pageService } from '@/services/pageService';

// Mock the file system
vi.mock('@/services/fileSystemFactory', () => ({
  fileSystemService: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    getRootHandle: vi.fn(),
  },
}));

// Mock markdown service
vi.mock('@/services/markdown', () => ({
  markdownService: {
    parse: vi.fn((content: string) => {
      // Extract content after frontmatter
      const parts = content.split('---\n');
      const actualContent = parts.length > 2 ? parts[2] : content;
      return {
        frontmatter: {
          id: 'test-page',
          title: 'Test Page',
          tags: [],
          createdAt: '2026-03-08T00:00:00Z',
          updatedAt: '2026-03-08T00:00:00Z',
          viewType: 'document',
        },
        content: actualContent.trim(),
      };
    }),
    serialize: vi.fn((frontmatter: any, content: string) => {
      return `---\n${JSON.stringify(frontmatter)}\n---\n${content}`;
    }),
  },
}));

import { fileSystemService } from '@/services/fileSystemFactory';
import { markdownService } from '@/services/markdown';
import type { Page } from '@/types';

describe('Highlight Integration', () => {
  const testPath = 'workspace/test.md';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store highlights inline in content (not in frontmatter)', async () => {
    // Setup: Content with a highlight
    const contentWithHighlight = 'This is <mark data-highlight-id="h1" data-highlight-color="#FFEB3B" data-highlight-style="highlight">highlighted text</mark> in the document.';

    (fileSystemService.readFile as any).mockResolvedValue(
      `---\n{"id":"test"}\n---\n${contentWithHighlight}`
    );

    const page = await pageService.loadPage(testPath);

    // Verify: Highlight is in content, not in frontmatter
    expect(page.content).toContain('<mark');
    expect(page.content).toContain('highlighted text');
    expect(page.content).toContain('data-highlight-id="h1"');
  });

  it('should use updatePage (full write) when content changes with highlights', async () => {
    // Setup
    const updatedContent = 'Original text <mark data-highlight-id="new" data-highlight-color="#FFEB3B" data-highlight-style="highlight">with highlights</mark>.';

    (fileSystemService.readFile as any).mockResolvedValue('mock');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    const page: Page = {
      id: 'test',
      title: 'Test',
      tags: [],
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-03-08T00:00:00Z',
      viewType: 'document',
      path: testPath,
      content: updatedContent, // Content changed
    };

    // Action: Use updatePage (not updatePageMetadata)
    await pageService.updatePage(page);

    // Verify: Full write was called with updated content
    expect(fileSystemService.writeFile).toHaveBeenCalledTimes(1);
    expect(markdownService.serialize).toHaveBeenCalledWith(
      expect.anything(),
      updatedContent // Content should be the updated version
    );
  });

  it('should preserve highlights when updating metadata only', async () => {
    // Setup: Existing content with highlights
    const contentWithHighlights = 'Text with <mark data-highlight-id="h1" data-highlight-color="#FFEB3B" data-highlight-style="highlight">existing highlight</mark>.';

    (markdownService.parse as any).mockReturnValue({
      frontmatter: {
        id: 'test',
        title: 'Old Title',
        tags: [],
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        viewType: 'document',
      },
      content: contentWithHighlights,
    });

    (fileSystemService.readFile as any).mockResolvedValue('mock');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    // Action: Update only title (metadata-only change)
    await pageService.updatePageMetadata(testPath, {
      title: 'New Title',
    });

    // Verify: Highlights in content are preserved
    expect(markdownService.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Title' }),
      contentWithHighlights // Highlights unchanged
    );
  });

  it('should handle multiple highlights in content', async () => {
    const contentWithMultipleHighlights = `
# Test Document

This has <mark data-highlight-id="h1" data-highlight-color="#FFEB3B" data-highlight-style="highlight">first highlight</mark>.

And <mark data-highlight-id="h2" data-highlight-color="#90CAF9" data-highlight-style="underline">second highlight</mark>.

Plus <mark data-highlight-id="h3" data-highlight-color="#C5E1A5" data-highlight-style="highlight">third one</mark>.
    `.trim();

    (fileSystemService.readFile as any).mockResolvedValue(
      `---\n{"id":"test"}\n---\n${contentWithMultipleHighlights}`
    );

    const page = await pageService.loadPage(testPath);

    // Verify: All highlights are preserved
    expect(page.content).toContain('data-highlight-id="h1"');
    expect(page.content).toContain('data-highlight-id="h2"');
    expect(page.content).toContain('data-highlight-id="h3"');
    expect(page.content).toContain('first highlight');
    expect(page.content).toContain('second highlight');
    expect(page.content).toContain('third one');
  });

  it('should handle highlights with special characters', async () => {
    const specialContent = 'Code with <mark data-highlight-id="code" data-highlight-color="#FFEB3B" data-highlight-style="highlight">special &lt;tag&gt; chars</mark>.';

    (fileSystemService.readFile as any).mockResolvedValue(
      `---\n{"id":"test"}\n---\n${specialContent}`
    );

    const page = await pageService.loadPage(testPath);

    // Verify: Special characters preserved
    expect(page.content).toContain('special &lt;tag&gt; chars');
  });

  it('should correctly distinguish between content changes and metadata changes', async () => {
    (fileSystemService.readFile as any).mockResolvedValue('mock');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    (markdownService.parse as any).mockReturnValue({
      frontmatter: {
        id: 'test',
        title: 'Test',
        tags: [],
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        viewType: 'document',
        kanbanColumn: 'Todo',
      },
      content: 'Original content',
    });

    // Scenario 1: Metadata-only change (column)
    await pageService.updatePageMetadata(testPath, {
      kanbanColumn: 'Done',
    });

    // Verify: Used updatePageMetadata, content unchanged
    const firstCall = (markdownService.serialize as any).mock.calls[0];
    expect(firstCall[1]).toBe('Original content'); // Content unchanged

    // Scenario 2: Content change (adding highlight)
    const page: Page = {
      id: 'test',
      title: 'Test',
      tags: [],
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-03-08T00:00:00Z',
      viewType: 'document',
      path: testPath,
      content: 'Content with <mark data-highlight-id="new">highlight</mark>',
      kanbanColumn: 'Done',
    };

    await pageService.updatePage(page);

    // Verify: Used updatePage, content changed
    const secondCall = (markdownService.serialize as any).mock.calls[1];
    expect(secondCall[1]).toContain('<mark'); // Content changed
  });
});
