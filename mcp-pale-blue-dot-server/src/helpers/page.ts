import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// Import types from frontend (Single Source of Truth)
import type { Memo } from '../../../src/types/page.js';

import { WORKSPACE_PATH } from '../utils/index.js';

export interface PageFrontmatter {
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

// Helper: Normalize frontmatter (highlights no longer in frontmatter)
export function normalizeFrontmatter(data: any): PageFrontmatter {
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

// Helper: Read a page file
export async function readPage(filename: string) {
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
export async function writePage(filename: string, frontmatter: PageFrontmatter, content: string) {
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
export async function listMarkdownFiles(): Promise<string[]> {
  const files = await fs.readdir(WORKSPACE_PATH);
  return files.filter(f => f.endsWith('.md'));
}
