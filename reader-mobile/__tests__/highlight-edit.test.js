/**
 * Integration test: changeHighlightColor and removeHighlight pure functions
 * Verifies color-change and deletion of existing <mark> tags.
 */

// ─── Inline the functions under test ────────────────────────────────

function changeHighlightColor(content, highlightId, newColor) {
  return content.replace(
    new RegExp(
      `(<mark[^>]*data-highlight-id="${highlightId}"[^>]*data-highlight-color=")[^"]*"`
    ),
    `$1${newColor}"`
  );
}

function removeHighlight(content, highlightId) {
  return content.replace(
    new RegExp(
      `<mark[^>]*data-highlight-id="${highlightId}"[^>]*>([\\s\\S]*?)<\\/mark>`
    ),
    '$1'
  );
}

// ─── changeHighlightColor tests ──────────────────────────────────────

describe('changeHighlightColor', () => {
  const baseContent =
    'Before <mark data-highlight-id="hl-abc" data-highlight-color="#FFEB3B" ' +
    'data-highlight-style="highlight" data-highlight-created="2026-01-01T00:00Z">highlighted text</mark> after.';

  it('changes the highlight color attribute', () => {
    const result = changeHighlightColor(baseContent, 'hl-abc', '#90EE90');
    expect(result).toContain('data-highlight-color="#90EE90"');
    expect(result).not.toContain('data-highlight-color="#FFEB3B"');
  });

  it('preserves all other attributes', () => {
    const result = changeHighlightColor(baseContent, 'hl-abc', '#ADD8E6');
    expect(result).toContain('data-highlight-id="hl-abc"');
    expect(result).toContain('data-highlight-style="highlight"');
    expect(result).toContain('data-highlight-created=');
    expect(result).toContain('>highlighted text</mark>');
  });

  it('preserves surrounding text', () => {
    const result = changeHighlightColor(baseContent, 'hl-abc', '#FFB6C1');
    expect(result.startsWith('Before ')).toBe(true);
    expect(result.endsWith(' after.')).toBe(true);
  });

  it('returns content unchanged when highlightId is not found', () => {
    const result = changeHighlightColor(baseContent, 'hl-nonexistent', '#FF0000');
    expect(result).toBe(baseContent);
  });

  it('does not affect a different highlight with different id', () => {
    const content =
      '<mark data-highlight-id="hl-001" data-highlight-color="#FFEB3B">first</mark> ' +
      '<mark data-highlight-id="hl-002" data-highlight-color="#FFEB3B">second</mark>';
    const result = changeHighlightColor(content, 'hl-001', '#90EE90');
    expect(result).toContain(
      '<mark data-highlight-id="hl-001" data-highlight-color="#90EE90">first</mark>'
    );
    expect(result).toContain(
      '<mark data-highlight-id="hl-002" data-highlight-color="#FFEB3B">second</mark>'
    );
  });
});

// ─── removeHighlight tests ───────────────────────────────────────────

describe('removeHighlight', () => {
  const baseContent =
    'Hello <mark data-highlight-id="hl-xyz" data-highlight-color="#ADD8E6" ' +
    'data-highlight-style="highlight" data-highlight-created="2026-01-01T00:00Z">world</mark> end.';

  it('removes the <mark> tag and preserves inner text', () => {
    const result = removeHighlight(baseContent, 'hl-xyz');
    expect(result).toBe('Hello world end.');
    expect(result).not.toContain('<mark');
    expect(result).not.toContain('</mark>');
  });

  it('preserves surrounding text correctly', () => {
    const result = removeHighlight(baseContent, 'hl-xyz');
    expect(result.startsWith('Hello ')).toBe(true);
    expect(result.endsWith(' end.')).toBe(true);
  });

  it('returns content unchanged when highlightId is not found', () => {
    const result = removeHighlight(baseContent, 'hl-notfound');
    expect(result).toBe(baseContent);
  });

  it('only removes the targeted highlight, leaves others intact', () => {
    const content =
      'A <mark data-highlight-id="hl-001" data-highlight-color="#FFEB3B">alpha</mark> ' +
      'B <mark data-highlight-id="hl-002" data-highlight-color="#90EE90">beta</mark> C';
    const result = removeHighlight(content, 'hl-001');
    expect(result).toContain('A alpha B');
    expect(result).toContain('<mark data-highlight-id="hl-002"');
    expect(result).not.toContain('data-highlight-id="hl-001"');
  });

  it('handles multi-word inner text', () => {
    const content =
      '<mark data-highlight-id="hl-multi" data-highlight-color="#FFA500">multiple words here</mark>';
    const result = removeHighlight(content, 'hl-multi');
    expect(result).toBe('multiple words here');
  });
});
