import { readPage, writePage, listMarkdownFiles, PageFrontmatter } from '../helpers/page.js';
import { parseHighlightsFromContent } from '../helpers/highlight.js';
import { generateId, sanitizeFileName } from '../utils/index.js';

export async function handleListPages() {
  const files = await listMarkdownFiles();
  const pages = await Promise.all(
    files.map(async (filename) => {
      const page = await readPage(filename);
      const inlineHighlights = parseHighlightsFromContent(page.content);
      return {
        filename,
        title: page.frontmatter.title,
        kanbanColumn: page.frontmatter.kanbanColumn || '(no column)',
        createdAt: page.frontmatter.createdAt,
        highlights: inlineHighlights.length,
        memos: page.frontmatter.memos?.length || 0,
        viewType: page.frontmatter.viewType,
      };
    })
  );
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(pages, null, 2),
      },
    ],
  };
}

export async function handleCreatePage(args: any) {
  const { title, content, kanbanColumn, viewType = 'document', parentId } = args;

  // Generate filename from title (using same sanitization as pageService)
  const sanitizedName = sanitizeFileName(title);
  const filename = `${sanitizedName}.md`;

  // Check if file already exists
  const files = await listMarkdownFiles();
  if (files.includes(filename)) {
    throw new Error(`File "${filename}" already exists. Use a different title.`);
  }

  // Create frontmatter (no highlights — they're inline in content)
  const frontmatter: PageFrontmatter = {
    id: generateId(),
    title,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewType,
    kanbanColumn,
    ...(parentId && { parentId }),
    memos: [],
  };

  // Write the file
  await writePage(filename, frontmatter, content);

  return {
    content: [
      {
        type: 'text',
        text: `Page created successfully: ${filename} (Column: ${kanbanColumn})`,
      },
    ],
  };
}

export async function handleReadPage(args: { filename: string }) {
  const { filename } = args;
  const page = await readPage(filename);
  const inlineHighlights = parseHighlightsFromContent(page.content);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            frontmatter: page.frontmatter,
            content: page.content,
            highlights: inlineHighlights,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleUpdatePageContent(args: any) {
  const { filename, content, append = false } = args;
  const page = await readPage(filename);

  // Update content (append or replace)
  const newContent = append
    ? `${page.content}\n\n${content}`.trim()
    : content;

  // Write back with updated content, preserving frontmatter
  await writePage(filename, page.frontmatter, newContent);

  return {
    content: [
      {
        type: 'text',
        text: `Page content updated successfully. ${append ? 'Content appended.' : 'Content replaced.'}`,
      },
    ],
  };
}

export async function handleEditPageSection(args: any) {
  const { filename, search, replace, mode = 'replace' } = args;

  const page = await readPage(filename);

  // Find the search text in the content
  const searchText = search.trim();
  const index = page.content.indexOf(searchText);

  if (index === -1) {
    throw new Error(`Text "${searchText}" not found in page content. Make sure the text matches exactly.`);
  }

  let newContent: string;
  switch (mode) {
    case 'replace':
      newContent = page.content.substring(0, index) + replace + page.content.substring(index + searchText.length);
      break;
    case 'insert_before':
      newContent = page.content.substring(0, index) + replace + '\n\n' + page.content.substring(index);
      break;
    case 'insert_after':
      newContent = page.content.substring(0, index + searchText.length) + '\n\n' + replace + page.content.substring(index + searchText.length);
      break;
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }

  await writePage(filename, page.frontmatter, newContent);

  return {
    content: [
      {
        type: 'text',
        text: `Section edited successfully using mode: ${mode}`,
      },
    ],
  };
}
