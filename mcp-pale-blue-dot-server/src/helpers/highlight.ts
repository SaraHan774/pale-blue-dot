/** Parse highlights from content by extracting <mark> tags */
export function parseHighlightsFromContent(content: string): Array<{ id: string; text: string; color: string; style: string; createdAt?: string }> {
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
export function insertHighlightTag(content: string, text: string, id: string, color: string, style: string): string {
  const index = content.indexOf(text);
  if (index === -1) throw new Error(`Text "${text}" not found in page content.`);

  const markOpen = `<mark data-highlight-id="${id}" data-highlight-color="${color}" data-highlight-style="${style}" data-highlight-created="${new Date().toISOString()}">`;
  const markClose = '</mark>';

  return content.substring(0, index) + markOpen + text + markClose + content.substring(index + text.length);
}

/** Remove a <mark> tag by highlight ID, keeping the inner text */
export function removeHighlightTag(content: string, highlightId: string): string {
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
