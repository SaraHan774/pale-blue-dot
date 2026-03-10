#!/usr/bin/env node

/**
 * MCP Server for Pale Blue Dot
 *
 * Provides tools for Claude to interact with highlights and memos
 * stored in markdown files. Highlights are stored inline as <mark> tags
 * in the content (not in YAML frontmatter).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// Import types from frontend (Single Source of Truth)
import type { Highlight, Memo } from '../../src/types/page.js';

interface PageFrontmatter {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: 'document' | 'kanban';
  parentId?: string;
  kanbanColumn?: string;
  googleCalendarEventId?: string;
  pinned?: boolean;
  pinnedAt?: string;
  memos?: Memo[];
}

// Workspace path - configurable via environment variable
const WORKSPACE_PATH = process.env.PALE_BLUE_DOT_WORKSPACE || path.join(process.cwd(), '../workspace');

// ── Highlight helpers (inline <mark> tags) ─────────────────────────

/** Parse highlights from content by extracting <mark> tags */
function parseHighlightsFromContent(content: string): Array<{ id: string; text: string; color: string; style: string; createdAt?: string }> {
  const highlights: Array<{ id: string; text: string; color: string; style: string; createdAt?: string }> = [];
  const markRegex = /<mark\s+data-highlight-id="([^"]*)"(?:\s+data-highlight-color="([^"]*)")?(?:\s+data-highlight-style="([^"]*)")?(?:\s+data-highlight-created="([^"]*)")?>([\s\S]*?)<\/mark>/g;
  let match;
  while ((match = markRegex.exec(content)) !== null) {
    highlights.push({
      id: match[1],
      text: match[5],
      color: match[2] || '#FFEB3B',
      style: match[3] || 'highlight',
      createdAt: match[4],
    });
  }
  return highlights;
}

/** Insert a <mark> tag around the first occurrence of `text` in `content` */
function insertHighlightTag(content: string, text: string, id: string, color: string, style: string): string {
  const index = content.indexOf(text);
  if (index === -1) throw new Error(`Text "${text}" not found in page content.`);

  const markOpen = `<mark data-highlight-id="${id}" data-highlight-color="${color}" data-highlight-style="${style}" data-highlight-created="${new Date().toISOString()}">`;
  const markClose = '</mark>';

  return content.substring(0, index) + markOpen + text + markClose + content.substring(index + text.length);
}

/** Remove a <mark> tag by highlight ID, keeping the inner text */
function removeHighlightTag(content: string, highlightId: string): string {
  const regex = new RegExp(
    `<mark\\s+data-highlight-id="${highlightId}"[^>]*>([\\s\\S]*?)<\\/mark>`,
    'g'
  );
  const newContent = content.replace(regex, '$1');
  if (newContent === content) {
    throw new Error(`Highlight with ID ${highlightId} not found in content`);
  }
  return newContent;
}

// ── Page I/O helpers ───────────────────────────────────────────────

// Helper: Read a page file
async function readPage(filename: string) {
  const filePath = path.join(WORKSPACE_PATH, filename);
  const rawContent = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(rawContent);
  return {
    frontmatter: normalizeFrontmatter(parsed.data),
    content: parsed.content.trim(),
    path: filePath,
  };
}

// Helper: Write a page file
async function writePage(filename: string, frontmatter: PageFrontmatter, content: string) {
  const filePath = path.join(WORKSPACE_PATH, filename);
  frontmatter.updatedAt = new Date().toISOString();

  // Use same YAML options as markdownService.serialize
  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false
  });
  const fileContent = `---\n${yamlStr}---\n${content}\n`;

  await fs.writeFile(filePath, fileContent, 'utf-8');
}

// Helper: List all markdown files
async function listMarkdownFiles(): Promise<string[]> {
  const files = await fs.readdir(WORKSPACE_PATH);
  return files.filter(f => f.endsWith('.md'));
}

// Helper: Generate unique ID (UUID v4 format matching codebase)
function generateId(): string {
  return crypto.randomUUID();
}

// Helper: Sanitize filename (matching pageService.sanitizeFileName)
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Normalize frontmatter (highlights no longer in frontmatter)
function normalizeFrontmatter(data: any): PageFrontmatter {
  const now = new Date().toISOString();

  return {
    id: data.id || crypto.randomUUID(),
    title: data.title || 'Untitled',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    viewType: data.viewType || 'document',
    ...(data.parentId && { parentId: data.parentId }),
    ...(data.dueDate && { dueDate: data.dueDate }),
    ...(data.kanbanColumn && { kanbanColumn: data.kanbanColumn }),
    ...(data.googleCalendarEventId && { googleCalendarEventId: data.googleCalendarEventId }),
    ...(data.pinned !== undefined && { pinned: data.pinned }),
    ...(data.pinnedAt && { pinnedAt: data.pinnedAt }),
    memos: Array.isArray(data.memos) ? data.memos : []
  };
}

// MCP Server
const server = new Server(
  {
    name: 'pale-blue-dot-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools: Tool[] = [
  {
    name: 'list_pages',
    description: 'List all pages/cards in the workspace. Shows title, kanban column, creation date, highlights count, and memos count. Use this to see which columns exist before creating new cards.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_page',
    description: 'Create a new kanban card/page. IMPORTANT: You must specify which column the card should be placed in. Use list_pages first to see existing columns, or use common columns like "To Do", "In Progress", or "Done".',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Page title (will be used as the card title)',
        },
        content: {
          type: 'string',
          description: 'Page content (markdown format)',
        },
        kanbanColumn: {
          type: 'string',
          description: 'REQUIRED: Which column to place this card in. Must match EXACTLY (case-sensitive). Common columns: "To Do", "In Progress", "Done", "Backlog", "Review". Use list_pages to see existing columns in use.',
        },
        viewType: {
          type: 'string',
          enum: ['document', 'kanban'],
          description: 'View type (default: document)',
        },
        parentId: {
          type: 'string',
          description: 'Optional parent page ID for nested pages',
        },
      },
      required: ['title', 'content', 'kanbanColumn'],
    },
  },
  {
    name: 'read_page',
    description: 'Read a specific page including all highlights (inline <mark> tags) and memos',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename (e.g., "My Page.md")',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'update_page_content',
    description: 'Update the markdown content of an existing page (preserves frontmatter)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        content: {
          type: 'string',
          description: 'New markdown content for the page',
        },
        append: {
          type: 'boolean',
          description: 'If true, append to existing content instead of replacing',
        },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'edit_page_section',
    description: 'Edit a specific section of page content by finding and replacing text. Useful for inserting content in the middle, modifying specific sentences, or replacing sections. The search text must match exactly.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        search: {
          type: 'string',
          description: 'The exact text to find in the page content (must match exactly)',
        },
        replace: {
          type: 'string',
          description: 'The new text to replace it with',
        },
        mode: {
          type: 'string',
          enum: ['replace', 'insert_before', 'insert_after'],
          description: 'Edit mode: "replace" replaces the search text, "insert_before" inserts before it, "insert_after" inserts after it (optional, defaults to "replace")',
        },
      },
      required: ['filename', 'search', 'replace'],
    },
  },
  {
    name: 'add_highlight',
    description: 'Add a new highlight to a page. Inserts an inline <mark> tag around the specified text in the content.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        text: {
          type: 'string',
          description: 'The exact text to highlight (must match exactly as it appears in the content)',
        },
        color: {
          type: 'string',
          description: 'Highlight color (optional, defaults to "#FFEB3B" yellow). Examples: "#FF5252" for red, "#42A5F5" for blue, "#66BB6A" for green',
        },
        style: {
          type: 'string',
          enum: ['highlight', 'underline'],
          description: 'Highlight style: "highlight" for background color or "underline" for underline (optional, defaults to "highlight")',
        },
      },
      required: ['filename', 'text'],
    },
  },
  {
    name: 'add_memo',
    description: 'Add a new memo to a page (independent or linked to a highlight)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        note: {
          type: 'string',
          description: 'The memo content',
        },
        type: {
          type: 'string',
          enum: ['independent', 'linked'],
          description: 'Memo type',
        },
        highlightId: {
          type: 'string',
          description: 'ID of the highlight to link to (required if type is "linked")',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the memo',
        },
      },
      required: ['filename', 'note', 'type'],
    },
  },
  {
    name: 'update_memo',
    description: 'Update an existing memo',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        memoId: {
          type: 'string',
          description: 'ID of the memo to update',
        },
        note: {
          type: 'string',
          description: 'Updated memo content',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated tags',
        },
      },
      required: ['filename', 'memoId', 'note'],
    },
  },
  {
    name: 'delete_highlight',
    description: 'Delete a highlight from a page (removes <mark> tag, keeps the text)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        highlightId: {
          type: 'string',
          description: 'ID of the highlight to delete',
        },
      },
      required: ['filename', 'highlightId'],
    },
  },
  {
    name: 'delete_memo',
    description: 'Delete a memo from a page',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The markdown filename',
        },
        memoId: {
          type: 'string',
          description: 'ID of the memo to delete',
        },
      },
      required: ['filename', 'memoId'],
    },
  },
  {
    name: 'list_images',
    description: 'List all images in the .images folder. Returns image filenames with their sizes and creation dates. Useful for finding screenshots, news captures, magazine scans, or other images to analyze.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_image',
    description: 'Read an image file from the .images folder for OCR and analysis. Returns the image data that Claude can analyze for text extraction, content understanding, news articles, magazine content, etc. Supports common formats (png, jpg, jpeg, gif, webp).',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The image filename (e.g., "screenshot.png", "news-article.jpg")',
        },
      },
      required: ['filename'],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_pages': {
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

      case 'create_page': {
        const { title, content, kanbanColumn, viewType = 'document', parentId } = args as any;

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

      case 'read_page': {
        const { filename } = args as { filename: string };
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

      case 'update_page_content': {
        const { filename, content, append = false } = args as any;
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

      case 'edit_page_section': {
        const { filename, search, replace, mode = 'replace' } = args as any;

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

      case 'add_highlight': {
        const {
          filename,
          text,
          color = '#FFEB3B',
          style = 'highlight',
        } = args as any;

        const page = await readPage(filename);
        const textToFind = text.trim();

        // Insert <mark> tag inline in content
        const highlightId = generateId();
        const newContent = insertHighlightTag(page.content, textToFind, highlightId, color, style);

        await writePage(filename, page.frontmatter, newContent);

        return {
          content: [
            {
              type: 'text',
              text: `Highlight added successfully. ID: ${highlightId}, Text: "${textToFind}"`,
            },
          ],
        };
      }

      case 'add_memo': {
        const { filename, note, type, highlightId, tags } = args as any;

        const page = await readPage(filename);

        // If linked memo, find the highlight in content
        let highlightText: string | undefined;
        let highlightColor: string | undefined;
        if (type === 'linked' && highlightId) {
          const inlineHighlights = parseHighlightsFromContent(page.content);
          const highlight = inlineHighlights.find(h => h.id === highlightId);
          if (!highlight) {
            throw new Error(`Highlight with ID ${highlightId} not found in content`);
          }
          highlightText = highlight.text;
          highlightColor = highlight.color;
        }

        const memo: Memo = {
          id: generateId(),
          type,
          note,
          highlightId,
          highlightText,
          highlightColor,
          tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: (page.frontmatter.memos?.length || 0) + 1,
        };

        page.frontmatter.memos = page.frontmatter.memos || [];
        page.frontmatter.memos.push(memo);

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Memo added successfully. ID: ${memo.id}`,
            },
          ],
        };
      }

      case 'update_memo': {
        const { filename, memoId, note, tags } = args as any;

        const page = await readPage(filename);
        const memo = page.frontmatter.memos?.find(m => m.id === memoId);

        if (!memo) {
          throw new Error(`Memo with ID ${memoId} not found`);
        }

        memo.note = note;
        memo.updatedAt = new Date().toISOString();
        if (tags !== undefined) {
          memo.tags = tags;
        }

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Memo updated successfully`,
            },
          ],
        };
      }

      case 'delete_highlight': {
        const { filename, highlightId } = args as { filename: string; highlightId: string };

        const page = await readPage(filename);

        // Remove <mark> tag from content, keeping inner text
        const newContent = removeHighlightTag(page.content, highlightId);

        await writePage(filename, page.frontmatter, newContent);

        return {
          content: [
            {
              type: 'text',
              text: `Highlight deleted successfully`,
            },
          ],
        };
      }

      case 'delete_memo': {
        const { filename, memoId } = args as { filename: string; memoId: string };

        const page = await readPage(filename);
        const initialLength = page.frontmatter.memos?.length || 0;
        page.frontmatter.memos = page.frontmatter.memos?.filter(m => m.id !== memoId);

        if ((page.frontmatter.memos?.length || 0) === initialLength) {
          throw new Error(`Memo with ID ${memoId} not found`);
        }

        await writePage(filename, page.frontmatter, page.content);

        return {
          content: [
            {
              type: 'text',
              text: `Memo deleted successfully`,
            },
          ],
        };
      }

      case 'list_images': {
        const imagesPath = path.join(WORKSPACE_PATH, '.images');
        try {
          const files = await fs.readdir(imagesPath);
          const imageFiles = files.filter(f =>
            /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(f)
          );

          const imagesInfo = await Promise.all(
            imageFiles.map(async (filename) => {
              const stats = await fs.stat(path.join(imagesPath, filename));
              return {
                filename,
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
              };
            })
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    count: imagesInfo.length,
                    images: imagesInfo,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No .images folder found',
                },
              ],
            };
          }
          throw error;
        }
      }

      case 'read_image': {
        const { filename } = args as { filename: string };
        const imagePath = path.join(WORKSPACE_PATH, '.images', filename);

        try {
          const imageBuffer = await fs.readFile(imagePath);
          const base64Image = imageBuffer.toString('base64');

          // Determine media type from extension
          const ext = path.extname(filename).toLowerCase();
          const mediaTypeMap: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
          };
          const mediaType = mediaTypeMap[ext] || 'image/png';

          return {
            content: [
              {
                type: 'image',
                data: base64Image,
                mimeType: mediaType,
              },
            ],
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Image not found: ${filename}`);
          }
          throw error;
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pale Blue Dot MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
