import { readPage, writePage } from '../helpers/page.js';
import { insertHighlightTag, removeHighlightTag } from '../helpers/highlight.js';
import { generateId } from '../utils/index.js';

export async function handleAddHighlight(args: any) {
  const {
    filename,
    text,
    color = '#FFEB3B',
    style = 'highlight',
  } = args;

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

export async function handleDeleteHighlight(args: { filename: string; highlightId: string }) {
  const { filename, highlightId } = args;

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
