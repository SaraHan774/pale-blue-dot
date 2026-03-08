/**
 * Page Service
 * High-level service for managing pages (CRUD operations)
 */

import { Page, PageFrontmatter, Highlight, FilterCriteria, SortOptions } from '@/types';
import { fileSystemService } from './fileSystemFactory';
import { markdownService } from './markdown';
import { perfMonitor } from '@/lib/performance';

export class PageService {
  /**
   * Load a page from the file system
   * NEW: Path is now directly to .md file (e.g., "workspace/Project A.md")
   * @param path - Page file path (e.g., "workspace/Project A.md")
   */
  async loadPage(path: string): Promise<Page> {
    const content = await fileSystemService.readFile(path);
    const rawData = markdownService.parse(content, path);

    // Extract legacy highlights for migration (stored in frontmatter before inline migration)
    const { _legacyHighlights, ...frontmatter } = rawData.frontmatter as any;

    // Determine highlights that need migration to inline <mark> tags
    let highlightsToMigrate: Highlight[] = [];

    // Source 1: Legacy frontmatter highlights
    if (_legacyHighlights?.length > 0) {
      highlightsToMigrate = _legacyHighlights;
    }

    // Source 2: Reconstruct from linked memos (fallback when highlights were lost from frontmatter)
    if (highlightsToMigrate.length === 0 && frontmatter.memos?.length > 0) {
      const linkedMemos = frontmatter.memos.filter(
        (m: any) => m.type === 'linked' && m.highlightText && m.highlightId
      );
      if (linkedMemos.length > 0) {
        // Only reconstruct if content doesn't already have <mark> tags for these
        const contentHasMarks = linkedMemos.some(
          (m: any) => rawData.content.includes(`data-highlight-id="${m.highlightId}"`)
        );
        if (!contentHasMarks) {
          highlightsToMigrate = linkedMemos.map((m: any) => ({
            id: m.highlightId,
            text: m.highlightText,
            color: m.highlightColor || '#FFEB3B',
            style: 'highlight' as const,
            createdAt: m.createdAt,
          }));
        }
      }
    }

    // FILE-LEVEL MIGRATION: Insert <mark> tags directly into markdown content
    let migratedContent = rawData.content;
    if (highlightsToMigrate.length > 0) {
      const result = this.migrateHighlightsToContent(migratedContent, highlightsToMigrate);
      if (result.migrated) {
        migratedContent = result.content;
        // Write back the migrated file immediately (remove highlights from frontmatter too)
        const cleanFrontmatter: PageFrontmatter = { ...frontmatter };
        const markdown = markdownService.serialize(cleanFrontmatter, migratedContent);
        await fileSystemService.writeFile(path, markdown);
      }
    }

    return {
      ...frontmatter,
      path,
      content: migratedContent,
    };
  }

  /**
   * Migrate highlights by inserting <mark> tags directly into markdown content.
   * Handles markdown escape differences (e.g., \~ in raw markdown vs ~ in highlight text).
   * @private
   */
  private migrateHighlightsToContent(
    content: string,
    highlights: Highlight[]
  ): { content: string; migrated: boolean } {
    let result = content;
    let anyMigrated = false;

    for (const h of highlights) {
      if (!h.text || !h.id) continue;

      // Skip if already migrated
      if (result.includes(`data-highlight-id="${h.id}"`)) continue;

      const markOpen = `<mark data-highlight-id="${h.id}" data-highlight-color="${h.color || '#FFEB3B'}" data-highlight-style="${h.style || 'highlight'}"${h.createdAt ? ` data-highlight-created="${h.createdAt}"` : ''}>`;
      const markClose = '</mark>';

      // Try exact match first
      let idx = result.indexOf(h.text);

      if (idx === -1) {
        // Try escape-aware matching: the raw markdown may have backslash-escaped chars
        // Common escapes in markdown: \~ \* \_ \` \[ \] \( \) \# \+ \- \. \! \| \{ \} \> \\
        idx = this.findEscapeAwareMatch(result, h.text);
      }

      if (idx !== -1) {
        // Find the actual matched text in content (may include backslash escapes)
        const matchedText = this.getEscapeAwareSlice(result, h.text, idx);
        result = result.substring(0, idx) + markOpen + matchedText + markClose + result.substring(idx + matchedText.length);
        anyMigrated = true;
      }
    }

    return { content: result, migrated: anyMigrated };
  }

  /**
   * Find text in content accounting for markdown backslash escapes.
   * For example, searching for "1~2회" should match "1\~2회" in content.
   * @private
   */
  private findEscapeAwareMatch(content: string, searchText: string): number {
    // Build a regex pattern that allows optional backslash before escapable chars
    const escapableChars = /[~*_`\[\]()#+\-.!|{}\\>]/;
    let pattern = '';
    for (const ch of searchText) {
      if (escapableChars.test(ch)) {
        // Allow optional backslash before this character
        pattern += '\\\\?' + this.escapeRegex(ch);
      } else {
        pattern += this.escapeRegex(ch);
      }
    }

    try {
      const regex = new RegExp(pattern);
      const match = content.match(regex);
      if (match && match.index !== undefined) {
        return match.index;
      }
    } catch {
      // Regex construction failed — skip
    }

    return -1;
  }

  /**
   * Get the actual slice of content that matches the highlight text,
   * accounting for backslash escapes.
   * @private
   */
  private getEscapeAwareSlice(content: string, searchText: string, startIdx: number): string {
    const escapableChars = /[~*_`\[\]()#+\-.!|{}\\>]/;
    let pattern = '';
    for (const ch of searchText) {
      if (escapableChars.test(ch)) {
        pattern += '\\\\?' + this.escapeRegex(ch);
      } else {
        pattern += this.escapeRegex(ch);
      }
    }

    try {
      const regex = new RegExp(pattern);
      const match = content.substring(startIdx).match(regex);
      if (match) {
        return match[0];
      }
    } catch {
      // fallback to searchText length
    }

    return content.substring(startIdx, startIdx + searchText.length);
  }

  /**
   * Escape a character for use in regex.
   * @private
   */
  private escapeRegex(ch: string): string {
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Load a page with its children
   * NEW: Children loaded by parentId instead of file path
   * @param path - Page file path (e.g., "workspace/My Page.md")
   * @param recursive - Whether to load children recursively
   */
  async loadPageWithChildren(path: string, recursive: boolean = false): Promise<Page> {
    const page = await this.loadPage(path);
    page.children = await this.loadChildren(page.id, recursive);
    return page;
  }

  /**
   * Load all children of a page
   * NEW: Children are determined by parentId field, not file system structure
   * @param parentId - Parent page ID
   * @param recursive - Whether to load children recursively
   */
  async loadChildren(parentId: string, recursive: boolean = false): Promise<Page[]> {
    const allPages = await this.getAllPages();
    const children = allPages.filter(page => page.parentId === parentId);

    if (recursive) {
      // Load grandchildren for each child
      for (const child of children) {
        child.children = await this.loadChildren(child.id, true);
      }
    }

    return children;
  }

  /**
   * Create a new page
   * NEW: Creates a single .md file instead of a directory with index.md
   * @param parentPath - Parent directory path (e.g., "workspace")
   * @param title - Page title
   * @param options - Additional page options
   */
  async createPage(
    parentPath: string,
    title: string,
    options: Partial<PageFrontmatter> = {}
  ): Promise<Page> {
    const now = new Date().toISOString();
    const sanitizedFileName = this.sanitizeFileName(title);
    const fileName = `${sanitizedFileName}.md`;

    // Get unique file name to avoid conflicts
    const uniqueFileName = await fileSystemService.getUniqueFileName(parentPath, fileName);
    const pagePath = `${parentPath}/${uniqueFileName}`;

    // Create frontmatter
    const frontmatter: PageFrontmatter = {
      id: crypto.randomUUID(),
      title,
      tags: [],
      createdAt: now,
      updatedAt: now,
      viewType: 'document',
      ...options
    };

    // Create the .md file with empty content
    const content = '';

    const markdown = markdownService.serialize(frontmatter, content);
    await fileSystemService.writeFile(pagePath, markdown);

    return {
      ...frontmatter,
      path: pagePath,
      content
    };
  }

  /**
   * Update page metadata only (no content change)
   * Optimized for metadata-only updates (e.g., column change, tags, pinning)
   * Reads existing content from file instead of using page.content
   * This avoids write amplification when content hasn't changed
   *
   * @param pagePath - Page file path
   * @param metadata - Partial metadata to update (only changed fields)
   */
  async updatePageMetadata(
    pagePath: string,
    metadata: Partial<Omit<PageFrontmatter, 'id' | 'createdAt' | 'path' | 'content'>>
  ): Promise<void> {
    return perfMonitor.measureAsync('pageService.updateMetadata', 'io', async () => {
      // Read existing file to get current frontmatter and content
      const fileContent = await fileSystemService.readFile(pagePath);
      const { frontmatter: currentFrontmatter, content } = markdownService.parse(fileContent, pagePath);

      // Merge metadata updates into current frontmatter
      const updatedFrontmatter: PageFrontmatter = {
        ...(currentFrontmatter as PageFrontmatter),
        ...metadata,
        updatedAt: new Date().toISOString(),
      };

      // Serialize and write back with unchanged content
      const markdown = markdownService.serialize(updatedFrontmatter, content);
      await fileSystemService.writeFile(pagePath, markdown);
    }, { fields: Object.keys(metadata).join(',') });
  }

  /**
   * Update a page
   * NEW: Path is directly to .md file, no /index.md suffix needed
   * @param page - Page to update
   */
  async updatePage(page: Page): Promise<void> {
    return perfMonitor.measureAsync('pageService.updatePage', 'io', async () => {
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
        ...(page.googleCalendarEventId && { googleCalendarEventId: page.googleCalendarEventId }),
        ...(page.pinned !== undefined && { pinned: page.pinned }),
        ...(page.pinnedAt && { pinnedAt: page.pinnedAt }),
        memos: page.memos || []
      };

      const markdown = markdownService.serialize(frontmatter, page.content);
      await fileSystemService.writeFile(page.path, markdown);
    }, { pageId: page.id, contentLength: page.content.length });
  }

  /**
   * Delete a page
   * @param path - Page path
   */
  async deletePage(path: string): Promise<void> {
    await fileSystemService.delete(path);
  }

  /**
   * Move a page to a different directory
   * NEW: Much simpler - just read, write to new location, and delete old
   * @param sourcePath - Current page file path (e.g., "workspace/Old.md")
   * @param targetParentPath - New parent directory (e.g., "workspace/subfolder")
   */
  async movePage(sourcePath: string, targetParentPath: string): Promise<string> {
    // Load the page content
    const page = await this.loadPage(sourcePath);

    // Extract file name from source path
    const pathParts = sourcePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // Get unique file name in target directory
    const uniqueFileName = await fileSystemService.getUniqueFileName(targetParentPath, fileName);
    const newPath = `${targetParentPath}/${uniqueFileName}`;

    // Write to new location
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
      ...(page.googleCalendarEventId && { googleCalendarEventId: page.googleCalendarEventId }),
      ...(page.pinned !== undefined && { pinned: page.pinned }),
      ...(page.pinnedAt && { pinnedAt: page.pinnedAt }),
      memos: page.memos || []
    };

    const markdown = markdownService.serialize(frontmatter, page.content);
    await fileSystemService.writeFile(newPath, markdown);

    // Delete the old file
    await this.deletePage(sourcePath);

    return newPath;
  }

  /**
   * Get all pages in the workspace
   */
  async getAllPages(): Promise<Page[]> {
    const pagePaths = await fileSystemService.scanPages('workspace');
    const pages: Page[] = [];

    for (const path of pagePaths) {
      const page = await this.loadPage(path);
      pages.push(page);
    }

    return pages;
  }

  /**
   * Filter pages based on criteria
   * @param criteria - Filter criteria
   * @param sort - Sort options
   */
  async filterPages(criteria: FilterCriteria, sort?: SortOptions): Promise<Page[]> {
    let pages = await this.getAllPages();

    // Apply filters
    if (criteria.tags && criteria.tags.length > 0) {
      pages = pages.filter(page =>
        criteria.tags!.some(tag => page.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
      );
    }

    if (criteria.searchText) {
      const searchLower = criteria.searchText.toLowerCase();
      pages = pages.filter(page =>
        page.title.toLowerCase().includes(searchLower) ||
        page.content.toLowerCase().includes(searchLower)
      );
    }

    if (criteria.viewType && criteria.viewType.length > 0) {
      pages = pages.filter(page => criteria.viewType!.includes(page.viewType));
    }

    if (criteria.dateRange) {
      const { start, end, field } = criteria.dateRange;
      pages = pages.filter(page => {
        const date = page[field];
        if (!date) return false;

        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    // Apply sorting
    if (sort) {
      pages.sort((a, b) => {
        const aVal = a[sort.field] || '';
        const bVal = b[sort.field] || '';

        if (sort.direction === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    return pages;
  }

  /**
   * Sanitize file name (remove invalid characters)
   * @private
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

}

// Singleton instance
export const pageService = new PageService();
