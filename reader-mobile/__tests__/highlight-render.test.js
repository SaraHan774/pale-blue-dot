'use strict';

const DEFAULT_COLOR = '#FFEB3B';

function extractHighlightColor(markTagHtml) {
  const match = markTagHtml.match(/data-highlight-color="([^"]+)"/);
  return match ? match[1] : DEFAULT_COLOR;
}

describe('Highlight rendering', () => {
  it('extracts data-highlight-color from <mark> tag', () => {
    const html = '<mark data-highlight-id="abc" data-highlight-color="#FF5733" data-highlight-style="highlight">highlighted</mark>';
    expect(extractHighlightColor(html)).toBe('#FF5733');
  });

  it('falls back to default color when attribute is missing', () => {
    const html = '<mark>no color attr</mark>';
    expect(extractHighlightColor(html)).toBe(DEFAULT_COLOR);
  });

  it('handles multiple highlights in content', () => {
    const content = [
      'Some text',
      '<mark data-highlight-color="#FFEB3B">yellow</mark>',
      'more text',
      '<mark data-highlight-color="#90EE90">green</mark>',
    ].join(' ');
    const marks = [...content.matchAll(/<mark[^>]*>/g)].map(m => extractHighlightColor(m[0]));
    expect(marks).toEqual(['#FFEB3B', '#90EE90']);
  });
});
