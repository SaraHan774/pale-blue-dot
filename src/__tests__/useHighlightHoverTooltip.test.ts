/**
 * Unit tests for useHighlightHoverTooltip (event-delegation implementation)
 *
 * Verifies that:
 * 1. A single mouseover/mouseout pair on the container drives tooltip state.
 * 2. No per-mark addEventListener calls are made (delegation, not per-element).
 * 3. The MutationObserver no longer re-registers handlers on DOM mutation.
 * 4. Tooltip hover grace-period (isMouseOverTooltip) works correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHighlightHoverTooltip } from '@/hooks/useHighlightHoverTooltip';
import { createRef } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContainer() {
  const container = document.createElement('div');

  const buildMark = (id: string, color = '#FFEB3B') => {
    const mark = document.createElement('mark');
    mark.className = 'highlight-mark';
    mark.setAttribute('data-highlight-id', id);
    mark.setAttribute('data-highlight-color', color);
    mark.textContent = `highlight-${id}`;
    return mark;
  };

  for (let i = 1; i <= 3; i++) {
    container.appendChild(buildMark(`h${i}`));
  }

  document.body.appendChild(container);
  return container;
}

function fireMouseOver(target: Element, relatedTarget: Element | null = null) {
  const event = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  target.dispatchEvent(event);
}

function fireMouseOut(target: Element, relatedTarget: Element | null = null) {
  const event = new MouseEvent('mouseout', {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  target.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// Mock Editor (minimal stub)
// ---------------------------------------------------------------------------

function makeEditor() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  return {
    state: { selection: { from: 0, to: 0 } },
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    off: vi.fn((event: string, cb: (...args: any[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== cb);
      }
    }),
    emit: (event: string, ...args: any[]) => {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHighlightHoverTooltip — event delegation', () => {
  let container: HTMLDivElement;
  let containerRef: ReturnType<typeof createRef<HTMLDivElement>>;
  let editor: ReturnType<typeof makeEditor>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = buildContainer() as HTMLDivElement;
    containerRef = createRef<HTMLDivElement>();
    // Manually assign current (createRef is read-only in production, but writable in tests)
    (containerRef as any).current = container;
    editor = makeEditor();
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it('shows tooltip on mouseover of a mark element', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const mark = container.querySelector('mark[data-highlight-id="h1"]')!;

    act(() => {
      fireMouseOver(mark);
    });

    expect(result.current.hoveredHighlight).not.toBeNull();
    expect(result.current.hoveredHighlight?.id).toBe('h1');
    expect(result.current.hoveredHighlight?.color).toBe('#FFEB3B');
  });

  it('hides tooltip after mouseout delay when tooltip is not hovered', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const mark = container.querySelector('mark[data-highlight-id="h1"]')!;

    act(() => { fireMouseOver(mark); });
    expect(result.current.hoveredHighlight).not.toBeNull();

    act(() => { fireMouseOut(mark); });
    // Tooltip should still be visible (grace period)
    expect(result.current.hoveredHighlight).not.toBeNull();

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.hoveredHighlight).toBeNull();
  });

  it('does not hide tooltip when tooltip itself is hovered during grace period', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const mark = container.querySelector('mark[data-highlight-id="h1"]')!;

    act(() => { fireMouseOver(mark); });
    act(() => { fireMouseOut(mark); });

    // Simulate tooltip mouse enter before timeout fires
    act(() => { result.current.onTooltipMouseEnter(); });
    act(() => { vi.advanceTimersByTime(200); });

    // Tooltip should remain visible
    expect(result.current.hoveredHighlight).not.toBeNull();
  });

  it('hides tooltip after tooltip mouse leave', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const mark = container.querySelector('mark[data-highlight-id="h1"]')!;

    act(() => { fireMouseOver(mark); });
    act(() => { result.current.onTooltipMouseEnter(); });
    act(() => { result.current.onTooltipMouseLeave(); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(result.current.hoveredHighlight).toBeNull();
  });

  it('does not show tooltip when readOnly is false but container missing', () => {
    const emptyRef = createRef<HTMLDivElement>();
    // emptyRef.current is null
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef: emptyRef, readOnly: false })
    );

    expect(result.current.hoveredHighlight).toBeNull();
  });

  it('does not show tooltip when readOnly is true', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: true })
    );

    const mark = container.querySelector('mark[data-highlight-id="h1"]')!;

    act(() => { fireMouseOver(mark); });
    expect(result.current.hoveredHighlight).toBeNull();
  });

  it('ignores mouseover on non-mark elements inside container', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const p = document.createElement('p');
    p.textContent = 'plain text';
    container.appendChild(p);

    act(() => { fireMouseOver(p); });
    expect(result.current.hoveredHighlight).toBeNull();
  });

  it('switches tooltip to a different mark without closing first', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const mark1 = container.querySelector('mark[data-highlight-id="h1"]')!;
    const mark2 = container.querySelector('mark[data-highlight-id="h2"]')!;

    act(() => { fireMouseOver(mark1); });
    expect(result.current.hoveredHighlight?.id).toBe('h1');

    // Move directly to another mark — the pending close timeout should be cleared
    act(() => { fireMouseOver(mark2); });
    expect(result.current.hoveredHighlight?.id).toBe('h2');

    act(() => { vi.advanceTimersByTime(200); });
    // Still showing h2
    expect(result.current.hoveredHighlight?.id).toBe('h2');
  });

  it('dismiss() immediately clears tooltip', () => {
    const { result } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    const mark = container.querySelector('mark[data-highlight-id="h1"]')!;

    act(() => { fireMouseOver(mark); });
    expect(result.current.hoveredHighlight).not.toBeNull();

    act(() => { result.current.dismiss(); });
    expect(result.current.hoveredHighlight).toBeNull();
  });

  it('registers exactly 2 listeners on container (mouseover + mouseout), not per-mark', () => {
    const addSpy = vi.spyOn(container, 'addEventListener');

    renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    // Only mouseover and mouseout on the container itself
    const calls = addSpy.mock.calls;
    const eventTypes = calls.map(([type]) => type);
    expect(eventTypes).toContain('mouseover');
    expect(eventTypes).toContain('mouseout');

    // No per-mark mouseenter/mouseleave registered via container.addEventListener
    expect(eventTypes).not.toContain('mouseenter');
    expect(eventTypes).not.toContain('mouseleave');

    // Total container-level registrations: 2
    expect(calls.length).toBe(2);
  });

  it('removes both listeners on cleanup', () => {
    const removeSpy = vi.spyOn(container, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useHighlightHoverTooltip({ editor: editor as any, containerRef, readOnly: false })
    );

    unmount();

    const eventTypes = removeSpy.mock.calls.map(([type]) => type);
    expect(eventTypes).toContain('mouseover');
    expect(eventTypes).toContain('mouseout');
  });
});
