import matter from 'gray-matter';
import type { Page } from '@/types';

/**
 * Parse markdown file with YAML frontmatter into Page object
 */
export function parseMarkdownFile(filename: string, content: string): Page {
  try {
    const { data, content: markdownContent } = matter(content);

    return {
      id: data.id || filename.replace('.md', ''),
      title: data.title || filename.replace('.md', ''),
      content: markdownContent.trim(),
      parentId: data.parentId,
      kanbanColumn: data.kanbanColumn,
      tags: data.tags || [],
      dueDate: data.dueDate,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      viewType: data.viewType || 'document',
      pinned: data.pinned || false,
      pinnedAt: data.pinnedAt,
    };
  } catch (error) {
    console.warn('Failed to parse YAML frontmatter for:', filename, error);
    console.log('Creating page with default values and raw content');

    // Fallback: create page with default values if YAML parsing fails
    const id = filename.replace('.md', '');
    return {
      id,
      title: filename.replace('.md', '').replace(/-/g, ' '),
      content: content, // Use raw content (includes broken frontmatter)
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewType: 'document',
      pinned: false,
    };
  }
}

/**
 * Extract all columns from pages
 */
export function extractColumns(pages: Page[]): string[] {
  const columns = new Set<string>();
  pages.forEach(page => {
    if (page.kanbanColumn) {
      columns.add(page.kanbanColumn);
    }
  });
  return Array.from(columns).sort();
}

/**
 * Group pages by column
 */
export function groupPagesByColumn(pages: Page[]): Record<string, Page[]> {
  const grouped: Record<string, Page[]> = {};

  pages.forEach(page => {
    const column = page.kanbanColumn || 'Uncategorized';
    if (!grouped[column]) {
      grouped[column] = [];
    }
    grouped[column].push(page);
  });

  // Sort pages within each column by title
  Object.keys(grouped).forEach(column => {
    grouped[column].sort((a, b) => a.title.localeCompare(b.title));
  });

  return grouped;
}

/**
 * Replace image paths in markdown content with local file paths
 */
export function replaceImagePaths(
  content: string,
  imageMap: Map<string, string>
): string {
  return content.replace(
    /!\[([^\]]*)\]\(\.images\/([^)]+)\)/g,
    (match, alt, filename) => {
      const localPath = imageMap.get(filename);
      if (localPath) {
        return `![${alt}](${localPath})`;
      }
      return match;
    }
  );
}
