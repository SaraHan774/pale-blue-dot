import { readPage, writePage } from '../helpers/page.js';
import { parseHighlightsFromContent } from '../helpers/highlight.js';
import { generateId } from '../utils/index.js';

// Import types from frontend (Single Source of Truth)
import type { Memo } from '../../../src/types/page.js';

export async function handleAddMemo(args: any) {
  const { filename, note, type, highlightId, tags } = args;

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

export async function handleUpdateMemo(args: any) {
  const { filename, memoId, note, tags } = args;

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

export async function handleDeleteMemo(args: { filename: string; memoId: string }) {
  const { filename, memoId } = args;

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
