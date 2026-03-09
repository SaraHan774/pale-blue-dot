/**
 * Integration test for memo operations with updatePageMetadata
 * Verifies that memo CRUD operations work correctly with the optimized metadata-only updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pageService } from '@/services/pageService';
import type { Memo } from '@/types';

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
    parse: vi.fn(() => ({
      frontmatter: {
        id: 'test-page',
        title: 'Test Page',
        tags: [],
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        viewType: 'document',
        memos: [],
      },
      content: 'Test content',
    })),
    serialize: vi.fn((frontmatter: any, content: string) => {
      return `---\n${JSON.stringify(frontmatter)}\n---\n${content}`;
    }),
  },
}));

import { fileSystemService } from '@/services/fileSystemFactory';
import { markdownService } from '@/services/markdown';

describe('Memo Integration with updatePageMetadata', () => {
  const testPath = 'workspace/test.md';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly update memos using updatePageMetadata', async () => {
    // Setup: Mock existing page
    const existingMemos: Memo[] = [
      {
        id: 'memo-1',
        type: 'independent',
        note: 'Original note',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        order: 0,
      },
    ];

    (markdownService.parse as any).mockReturnValue({
      frontmatter: {
        id: 'test-page',
        title: 'Test Page',
        tags: [],
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        viewType: 'document',
        memos: existingMemos,
      },
      content: 'Test content',
    });

    (fileSystemService.readFile as any).mockResolvedValue('mock-file-content');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    // Action: Add a new memo
    const newMemo: Memo = {
      id: 'memo-2',
      type: 'linked',
      note: 'New memo note',
      highlightId: 'highlight-1',
      highlightText: 'Some text',
      highlightColor: '#FFEB3B',
      createdAt: '2026-03-08T01:00:00Z',
      updatedAt: '2026-03-08T01:00:00Z',
      order: 1,
    };

    const updatedMemos = [...existingMemos, newMemo];
    await pageService.updatePageMetadata(testPath, { memos: updatedMemos });

    // Verify: Check that writeFile was called with correct data
    expect(fileSystemService.writeFile).toHaveBeenCalledTimes(1);
    expect(markdownService.serialize).toHaveBeenCalledWith(
      expect.objectContaining({
        memos: updatedMemos,
        updatedAt: expect.any(String),
      }),
      'Test content' // Content should remain unchanged
    );
  });

  it('should preserve memos field type in updatePageMetadata signature', async () => {
    // This test verifies TypeScript type compatibility
    const testMemos: Memo[] = [
      {
        id: 'test-id',
        type: 'independent',
        note: 'Test',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        order: 0,
      },
    ];

    (fileSystemService.readFile as any).mockResolvedValue('mock');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    // Should compile without TypeScript errors
    await pageService.updatePageMetadata(testPath, {
      memos: testMemos,
    });

    // Should also work with other metadata fields
    await pageService.updatePageMetadata(testPath, {
      title: 'New Title',
      memos: testMemos,
      tags: ['tag1', 'tag2'],
      kanbanColumn: 'Done',
    });

    expect(fileSystemService.writeFile).toHaveBeenCalledTimes(2);
  });

  it('should handle empty memos array', async () => {
    (fileSystemService.readFile as any).mockResolvedValue('mock');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    await pageService.updatePageMetadata(testPath, {
      memos: [],
    });

    expect(markdownService.serialize).toHaveBeenCalledWith(
      expect.objectContaining({
        memos: [],
      }),
      'Test content'
    );
  });

  it('should not modify content when updating memos', async () => {
    const originalContent = '# Original Content\n\nThis should stay unchanged.';

    (markdownService.parse as any).mockReturnValue({
      frontmatter: {
        id: 'test',
        title: 'Test',
        tags: [],
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        viewType: 'document',
        memos: [],
      },
      content: originalContent,
    });

    (fileSystemService.readFile as any).mockResolvedValue('mock');
    (fileSystemService.writeFile as any).mockResolvedValue(undefined);

    const newMemos: Memo[] = [
      {
        id: 'new-memo',
        type: 'independent',
        note: 'New note',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
        order: 0,
      },
    ];

    await pageService.updatePageMetadata(testPath, { memos: newMemos });

    // Verify content remains unchanged
    expect(markdownService.serialize).toHaveBeenCalledWith(
      expect.anything(),
      originalContent // Content should be exactly the same
    );
  });
});
