import { Tool } from '@modelcontextprotocol/sdk/types.js';

// Define available tools
export const tools: Tool[] = [
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
