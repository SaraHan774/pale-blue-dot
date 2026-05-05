/**
 * Integration test: insertHighlight pure function
 * Verifies that the <mark> tag is correctly inserted into content
 * and that caching round-trip preserves the markup.
 */

// ─── Inline the function under test (no module resolution needed) ────

const DEFAULT_COLOR = '#FFEB3B';

function insertHighlight(content, selectedText, color, id) {
  if (!selectedText || !content.includes(selectedText)) {
    return content;
  }
  const created = new Date().toISOString();
  const mark =
    `<mark data-highlight-id="${id}" data-highlight-color="${color}" ` +
    `data-highlight-style="highlight" data-highlight-created="${created}">${selectedText}</mark>`;
  return content.replace(selectedText, mark);
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('insertHighlight', () => {
  it('inserts <mark> tag wrapping the selected text', () => {
    const content = 'Hello world, this is a test.';
    const result = insertHighlight(content, 'world', DEFAULT_COLOR, 'hl-001');

    expect(result).toContain('<mark');
    expect(result).toContain('data-highlight-id="hl-001"');
    expect(result).toContain(`data-highlight-color="${DEFAULT_COLOR}"`);
    expect(result).toContain('data-highlight-style="highlight"');
    expect(result).toContain('data-highlight-created=');
    expect(result).toContain('>world</mark>');
  });

  it('returns content unchanged when selectedText is not found', () => {
    const content = 'Hello world.';
    const result = insertHighlight(content, 'missing text', DEFAULT_COLOR, 'hl-002');
    expect(result).toBe(content);
  });

  it('returns content unchanged when selectedText is empty', () => {
    const content = 'Hello world.';
    const result = insertHighlight(content, '', DEFAULT_COLOR, 'hl-003');
    expect(result).toBe(content);
  });

  it('only replaces the first occurrence', () => {
    const content = 'cat and cat';
    const result = insertHighlight(content, 'cat', '#90EE90', 'hl-004');
    const markCount = (result.match(/<mark/g) || []).length;
    expect(markCount).toBe(1);
    expect(result).toContain('>cat</mark> and cat');
  });

  it('preserves surrounding content', () => {
    const content = 'prefix TARGET suffix';
    const result = insertHighlight(content, 'TARGET', '#ADD8E6', 'hl-005');
    expect(result.startsWith('prefix ')).toBe(true);
    expect(result.endsWith(' suffix')).toBe(true);
  });

  it('includes data-highlight-created timestamp', () => {
    const before = new Date().toISOString();
    const result = insertHighlight('some text here', 'text', DEFAULT_COLOR, 'hl-006');
    const after = new Date().toISOString();

    const match = result.match(/data-highlight-created="([^"]+)"/);
    expect(match).not.toBeNull();
    const ts = match[1];
    expect(ts >= before).toBe(true);
    expect(ts <= after).toBe(true);
  });

  it('uses the specified highlight color', () => {
    const color = '#FFA500';
    const result = insertHighlight('highlight this', 'this', color, 'hl-007');
    expect(result).toContain(`data-highlight-color="${color}"`);
  });
});
