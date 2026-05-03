import { useEffect, useRef, useState, RefObject } from 'react';
import { Editor } from '@tiptap/core';

interface HoveredHighlight {
  id: string;
  color: string;
  rect: DOMRect;
}

interface UseHighlightHoverTooltipOptions {
  editor: Editor | null;
  containerRef: RefObject<HTMLDivElement | null>;
  readOnly: boolean;
}

export function useHighlightHoverTooltip({
  editor,
  containerRef,
  readOnly,
}: UseHighlightHoverTooltipOptions) {
  const [hoveredHighlight, setHoveredHighlight] = useState<HoveredHighlight | null>(null);
  const isMouseOverTooltipRef = useRef(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use event delegation: single mouseover/mouseout on container instead of
  // per-mark mouseenter/mouseleave that required full detach→re-attach on every DOM mutation.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor || readOnly) return;

    const handleMouseOver = (e: MouseEvent) => {
      const mark = (e.target as Element).closest('mark.highlight-mark[data-highlight-id]');
      if (!mark) return;

      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      const highlightId = mark.getAttribute('data-highlight-id');
      const color =
        mark.getAttribute('data-highlight-color') ||
        (mark as HTMLElement).style.backgroundColor ||
        '';
      if (!highlightId) return;

      const rect = mark.getBoundingClientRect();
      setHoveredHighlight({ id: highlightId, color, rect });
    };

    const handleMouseOut = (e: MouseEvent) => {
      const mark = (e.target as Element).closest('mark.highlight-mark[data-highlight-id]');
      if (!mark) return;

      // Check that we are actually leaving the mark, not moving into a child element
      const relatedTarget = e.relatedTarget as Element | null;
      if (relatedTarget && mark.contains(relatedTarget)) return;

      closeTimeoutRef.current = setTimeout(() => {
        if (!isMouseOverTooltipRef.current) {
          setHoveredHighlight(null);
        }
      }, 150);
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [editor, readOnly, containerRef]);

  // Dismiss tooltip when text selection starts
  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) setHoveredHighlight(null);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor]);

  /** Call from tooltip's onMouseEnter */
  const onTooltipMouseEnter = () => {
    isMouseOverTooltipRef.current = true;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  /** Call from tooltip's onMouseLeave */
  const onTooltipMouseLeave = () => {
    isMouseOverTooltipRef.current = false;
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredHighlight(null);
    }, 100);
  };

  const dismiss = () => setHoveredHighlight(null);

  return {
    hoveredHighlight,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    dismiss,
  };
}
