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
} from '@modelcontextprotocol/sdk/types.js';

import { tools } from './tools/definitions.js';
import {
  handleListPages,
  handleCreatePage,
  handleReadPage,
  handleUpdatePageContent,
  handleEditPageSection,
} from './tools/pages.js';
import { handleAddHighlight, handleDeleteHighlight } from './tools/highlights.js';
import { handleAddMemo, handleUpdateMemo, handleDeleteMemo } from './tools/memos.js';
import { handleListImages, handleReadImage } from './tools/images.js';

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

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_pages':
        return await handleListPages();

      case 'create_page':
        return await handleCreatePage(args as any);

      case 'read_page':
        return await handleReadPage(args as { filename: string });

      case 'update_page_content':
        return await handleUpdatePageContent(args as any);

      case 'edit_page_section':
        return await handleEditPageSection(args as any);

      case 'add_highlight':
        return await handleAddHighlight(args as any);

      case 'delete_highlight':
        return await handleDeleteHighlight(args as { filename: string; highlightId: string });

      case 'add_memo':
        return await handleAddMemo(args as any);

      case 'update_memo':
        return await handleUpdateMemo(args as any);

      case 'delete_memo':
        return await handleDeleteMemo(args as { filename: string; memoId: string });

      case 'list_images':
        return await handleListImages();

      case 'read_image':
        return await handleReadImage(args as { filename: string });

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
