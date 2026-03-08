/**
 * Mock Data Generators for Performance Testing
 * Creates realistic test data for benchmarking
 */

import { Page } from '@/types';

const SAMPLE_COLUMNS = ['To Do', 'In Progress', 'Review', 'Done', 'Blocked'];
const SAMPLE_TAGS = ['urgent', 'bug', 'feature', 'docs', 'refactor', 'test', 'design', 'research'];
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);

/**
 * Generate a mock page with realistic content
 */
export function generateMockPage(overrides?: Partial<Page>): Page {
  const id = crypto.randomUUID();
  const contentSize = overrides?.content?.length || 5000;
  const content = generateMarkdownContent(contentSize);

  return {
    id,
    title: `Page ${id.slice(0, 8)}`,
    content,
    tags: randomTags(2),
    kanbanColumn: randomColumn(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: `workspace/Page-${id}.md`,
    viewType: 'document',
    memos: [],
    ...overrides,
  };
}

/**
 * Generate multiple mock pages
 */
export function generateMockPages(count: number, options?: {
  contentSize?: number;
  withChildren?: boolean;
}): Page[] {
  const pages: Page[] = [];
  const rootCount = Math.floor(count * 0.7); // 70% root pages
  const childCount = count - rootCount;

  // Generate root pages
  for (let i = 0; i < rootCount; i++) {
    pages.push(
      generateMockPage({
        content: generateMarkdownContent(options?.contentSize || 5000),
        title: `Root Page ${i + 1}`,
      })
    );
  }

  // Generate child pages
  if (options?.withChildren && rootCount > 0) {
    for (let i = 0; i < childCount; i++) {
      const parentIndex = Math.floor(Math.random() * rootCount);
      pages.push(
        generateMockPage({
          content: generateMarkdownContent(options?.contentSize || 3000),
          title: `Child Page ${i + 1}`,
          parentId: pages[parentIndex].id,
        })
      );
    }
  }

  return pages;
}

/**
 * Generate realistic markdown content
 */
function generateMarkdownContent(targetSize: number): string {
  const sections = [
    '# Main Heading\n\n',
    LOREM + '\n\n',
    '## Section 1\n\n',
    '- **Bold text**: ' + LOREM.slice(0, 100) + '\n',
    '- *Italic text*: ' + LOREM.slice(0, 100) + '\n',
    '- `code`: inline code example\n\n',
    '### Subsection\n\n',
    LOREM + '\n\n',
    '```javascript\n',
    'function example() {\n',
    '  return "code block";\n',
    '}\n',
    '```\n\n',
    '## Section 2\n\n',
    '- [ ] Task 1\n',
    '- [x] Task 2\n',
    '- [ ] Task 3\n\n',
    LOREM + '\n\n',
    '[[Wiki Link]] and [[another-id|Display Text]]\n\n',
    LOREM + '\n\n',
  ];

  let content = sections.join('');

  // Repeat sections until we reach target size
  while (content.length < targetSize) {
    content += sections.join('');
  }

  return content.slice(0, targetSize);
}

/**
 * Get random tags
 */
function randomTags(count: number): string[] {
  const shuffled = [...SAMPLE_TAGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get random column
 */
function randomColumn(): string {
  return SAMPLE_COLUMNS[Math.floor(Math.random() * SAMPLE_COLUMNS.length)];
}

/**
 * Generate a workspace scenario for testing
 */
export interface WorkspaceScenario {
  pages: Page[];
  metadata: {
    totalPages: number;
    totalColumns: number;
    totalTags: number;
    avgContentSize: number;
    totalContentSize: number;
  };
}

export function generateWorkspaceScenario(
  pageCount: number,
  contentSize: number = 5000
): WorkspaceScenario {
  const pages = generateMockPages(pageCount, { contentSize, withChildren: true });

  const allColumns = new Set(pages.map(p => p.kanbanColumn).filter(Boolean));
  const allTags = new Set(pages.flatMap(p => p.tags));
  const totalContentSize = pages.reduce((sum, p) => sum + p.content.length, 0);
  const avgContentSize = totalContentSize / pages.length;

  return {
    pages,
    metadata: {
      totalPages: pages.length,
      totalColumns: allColumns.size,
      totalTags: allTags.size,
      avgContentSize: Math.round(avgContentSize),
      totalContentSize,
    },
  };
}

/**
 * Common test scenarios
 */
export const SCENARIOS = {
  SMALL: { pages: 50, contentSize: 2000 },
  MEDIUM: { pages: 200, contentSize: 5000 },
  LARGE: { pages: 500, contentSize: 10000 },
  XLARGE: { pages: 1000, contentSize: 15000 },
} as const;
