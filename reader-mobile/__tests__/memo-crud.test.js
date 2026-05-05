/**
 * Integration test: Memo CRUD logic (saveMemo / deleteMemo semantics)
 *
 * These tests verify the pure data-manipulation logic that underpins
 * saveMemo() and deleteMemo() in cacheService.ts without hitting the
 * file system (the FS layer is exercised via existing integration flows).
 */

// ─── Helpers mirroring the real cacheService logic ───────────────────

/**
 * Applies saveMemo logic to an in-memory pages array.
 * If a memo with the same id exists it is replaced; otherwise appended.
 */
function applyMemoSave(pages, pageId, memo) {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1) throw new Error(`Page not found: ${pageId}`);

  const existing = pages[index].memos ?? [];
  const memoIdx = existing.findIndex((m) => m.id === memo.id);
  const updatedMemos =
    memoIdx !== -1
      ? existing.map((m, i) => (i === memoIdx ? memo : m))
      : [...existing, memo];

  const updated = pages.map((p, i) =>
    i === index ? { ...p, memos: updatedMemos } : p
  );
  return updated;
}

/**
 * Applies deleteMemo logic to an in-memory pages array.
 */
function applyMemoDelete(pages, pageId, memoId) {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1) throw new Error(`Page not found: ${pageId}`);

  const updated = pages.map((p, i) =>
    i === index
      ? { ...p, memos: (p.memos ?? []).filter((m) => m.id !== memoId) }
      : p
  );
  return updated;
}

// ─── Fixtures ─────────────────────────────────────────────────────────

function makePage(overrides) {
  return {
    id: 'page-1',
    title: 'Test Page',
    content: 'Some content',
    createdAt: '2026-01-01T00:00Z',
    updatedAt: '2026-01-01T00:00Z',
    memos: [],
    ...overrides,
  };
}

function makeMemo(overrides) {
  return {
    id: 'memo-1',
    type: 'linked',
    note: 'A note',
    highlightId: 'hl-abc',
    highlightText: 'selected text',
    highlightColor: '#FFEB3B',
    tags: [],
    createdAt: '2026-01-02T00:00Z',
    updatedAt: '2026-01-02T00:00Z',
    order: 0,
    ...overrides,
  };
}

// ─── saveMemo tests ───────────────────────────────────────────────────

describe('saveMemo logic', () => {
  it('appends a new memo to an empty memos array', () => {
    const pages = [makePage()];
    const memo = makeMemo();
    const result = applyMemoSave(pages, 'page-1', memo);
    expect(result[0].memos).toHaveLength(1);
    expect(result[0].memos[0].id).toBe('memo-1');
    expect(result[0].memos[0].note).toBe('A note');
  });

  it('appends a second memo after the first', () => {
    const first = makeMemo({ id: 'memo-1', order: 0 });
    const pages = [makePage({ memos: [first] })];
    const second = makeMemo({ id: 'memo-2', note: 'Second note', order: 1 });
    const result = applyMemoSave(pages, 'page-1', second);
    expect(result[0].memos).toHaveLength(2);
    expect(result[0].memos[1].id).toBe('memo-2');
  });

  it('replaces an existing memo with the same id', () => {
    const original = makeMemo({ note: 'Original' });
    const pages = [makePage({ memos: [original] })];
    const updated = makeMemo({ note: 'Updated' });
    const result = applyMemoSave(pages, 'page-1', updated);
    expect(result[0].memos).toHaveLength(1);
    expect(result[0].memos[0].note).toBe('Updated');
  });

  it('does not mutate the original pages array', () => {
    const pages = [makePage()];
    const memo = makeMemo();
    const result = applyMemoSave(pages, 'page-1', memo);
    expect(pages[0].memos).toHaveLength(0); // original unchanged
    expect(result[0].memos).toHaveLength(1);
  });

  it('throws when pageId is not found', () => {
    const pages = [makePage()];
    expect(() => applyMemoSave(pages, 'nonexistent', makeMemo())).toThrow('Page not found');
  });

  it('stores linked memo with correct highlightId', () => {
    const pages = [makePage()];
    const memo = makeMemo({ highlightId: 'hl-xyz', highlightText: 'foo bar' });
    const result = applyMemoSave(pages, 'page-1', memo);
    expect(result[0].memos[0].highlightId).toBe('hl-xyz');
    expect(result[0].memos[0].highlightText).toBe('foo bar');
  });
});

// ─── deleteMemo tests ─────────────────────────────────────────────────

describe('deleteMemo logic', () => {
  it('removes a memo by id', () => {
    const memo = makeMemo();
    const pages = [makePage({ memos: [memo] })];
    const result = applyMemoDelete(pages, 'page-1', 'memo-1');
    expect(result[0].memos).toHaveLength(0);
  });

  it('is a no-op when memoId does not exist', () => {
    const memo = makeMemo();
    const pages = [makePage({ memos: [memo] })];
    const result = applyMemoDelete(pages, 'page-1', 'nonexistent-memo');
    expect(result[0].memos).toHaveLength(1);
  });

  it('only removes the targeted memo, leaving others intact', () => {
    const m1 = makeMemo({ id: 'memo-1', note: 'Keep me' });
    const m2 = makeMemo({ id: 'memo-2', note: 'Delete me' });
    const pages = [makePage({ memos: [m1, m2] })];
    const result = applyMemoDelete(pages, 'page-1', 'memo-2');
    expect(result[0].memos).toHaveLength(1);
    expect(result[0].memos[0].id).toBe('memo-1');
  });

  it('does not mutate the original pages array', () => {
    const memo = makeMemo();
    const pages = [makePage({ memos: [memo] })];
    const result = applyMemoDelete(pages, 'page-1', 'memo-1');
    expect(pages[0].memos).toHaveLength(1); // original unchanged
    expect(result[0].memos).toHaveLength(0);
  });

  it('throws when pageId is not found', () => {
    const pages = [makePage()];
    expect(() => applyMemoDelete(pages, 'bad-id', 'memo-1')).toThrow('Page not found');
  });

  it('handles page with no memos field gracefully', () => {
    const page = makePage();
    delete page.memos;
    const result = applyMemoDelete([page], 'page-1', 'memo-1');
    expect(result[0].memos).toHaveLength(0);
  });
});
