import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { createPortal } from 'react-dom';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';

const lowlight = createLowlight(common);
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { KeyboardShortcuts } from '../lib/tiptap/extensions/KeyboardShortcuts';
import { WikiLink } from '../lib/tiptap/extensions/WikiLink';
import { WikiLinkSuggestion } from '../lib/tiptap/extensions/WikiLinkSuggestion';
import { HighlightMark } from '../lib/tiptap/extensions/HighlightMark';
import { ResolvableImage } from '../lib/tiptap/extensions/ResolvableImage';
import { SafeLink } from '../lib/tiptap/extensions/SafeLink';
import { Page } from '@/types';
import { linkService, saveImage } from '@/services';
import { fileSystemService } from '@/services/fileSystemFactory';
import { AppSlashCommand } from '@/data/defaultSlashCommands';
import { getHighlightColor, getUnderlineColor } from '@/utils/colorAdjust';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { useHighlightHoverTooltip } from '@/hooks/useHighlightHoverTooltip';
import { useBubbleMenuDismiss } from '@/hooks/useBubbleMenuDismiss';
import 'highlight.js/styles/github.css';
import './TiptapEditor.css';

// --- Types ---

interface TiptapEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  pagePath?: string; // For image resolution
  pages?: Page[];
  onNavigate?: (pageId: string) => void;
  onHighlightClick?: (highlightId: string) => void;
  onEditorReady?: (editor: Editor) => void;
  slashCommands?: AppSlashCommand[];
  highlightColors?: string[];
  onHighlight?: (color: string, style: 'highlight' | 'underline') => void;
  onHighlightChangeColor?: (highlightId: string, newColor: string) => void;
  onHighlightDelete?: (highlightId: string) => void;
}

const DEFAULT_HIGHLIGHT_COLORS = ['#FFEB3B', '#C5E1A5', '#90CAF9', '#FFCC80', '#F48FB1'];

// --- Helpers ---

/** Find the position range of a highlight mark by its ID. */
function findHighlightRange(doc: ProseMirrorNode, highlightId: string) {
  let minPos = Infinity;
  let maxPos = -Infinity;
  let style = 'highlight';

  doc.descendants((node, pos) => {
    if (!node.isText || node.marks.length === 0) return;
    const mark = node.marks.find((m) => m.type.name === 'highlight' && m.attrs.id === highlightId);
    if (mark) {
      minPos = Math.min(minPos, pos);
      maxPos = Math.max(maxPos, pos + node.nodeSize);
      style = mark.attrs.style || 'highlight';
    }
  });

  return minPos === Infinity ? null : { from: minPos, to: maxPos, style };
}

/** Render wiki link suggestion items into a container element. */
function renderSuggestionItems(
  container: HTMLElement,
  items: Array<{ id: string; label: string }>,
  onSelect: (item: { id: string; label: string }) => void,
) {
  if (items.length === 0) {
    container.innerHTML = '<div class="suggestion-item empty">No pages found</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item, index) => `
        <div class="suggestion-item" data-index="${index}">
          <span class="suggestion-icon">📄</span>
          <span class="suggestion-label">${item.label}</span>
        </div>
      `,
    )
    .join('');

  container.querySelectorAll('.suggestion-item').forEach((el) => {
    el.addEventListener('click', () => {
      const index = parseInt(el.getAttribute('data-index')!);
      onSelect(items[index]);
    });
  });
}

// --- Component ---

export default function TiptapEditor({
  content,
  onChange,
  readOnly = false,
  pagePath = '',
  pages = [],
  onNavigate,
  onHighlightClick,
  onEditorReady,
  slashCommands: slashCommandsProp = [],
  highlightColors = DEFAULT_HIGHLIGHT_COLORS,
  onHighlight,
  onHighlightChangeColor,
  onHighlightDelete,
}: TiptapEditorProps) {
  const editorReadyCalledRef = useRef(false);
  const internalUpdateRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const [highlightTab, setHighlightTab] = useState<'highlight' | 'underline'>('highlight');

  // Custom hooks
  const slash = useSlashCommands(slashCommandsProp, editorRef);
  const slashKeyDownRef = useRef(slash.handleKeyDown);
  slashKeyDownRef.current = slash.handleKeyDown;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        // Disable default Link extension (using SafeLink instead for security)
        link: false,
      }),
      // Use SafeLink extension with URL validation (CVE-2025-14284 mitigation)
      SafeLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: 'code-block' },
      }),
      Markdown.configure({ html: true, breaks: false, linkify: true }),
      KeyboardShortcuts,
      ResolvableImage.configure({
        resolveImageSrc: async (src: string) => {
          // Read the image binary from the virtual filesystem and create a blob URL
          const fullPath = src.startsWith('.images/')
            ? `workspace/${src}`
            : src;
          const data = await fileSystemService.readBinaryFile(fullPath);
          const ext = src.split('.').pop()?.toLowerCase() || 'png';
          const mimeMap: Record<string, string> = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
          };
          const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeMap[ext] || 'image/png' });
          return URL.createObjectURL(blob);
        },
        saveImage: async (file: File) => saveImage(pagePath, file),
      }),
      HighlightMark.configure({
        onHighlightClick: (id: string) => onHighlightClick?.(id),
      }),
      Table.configure({ resizable: false, HTMLAttributes: { class: 'tiptap-table' } }),
      TableRow,
      TableCell,
      TableHeader,
      WikiLink.configure({
        onNavigate: async (ref: string, isIdBased: boolean) => {
          if (!onNavigate) return;
          const pageId = await linkService.resolvePageRef(ref, isIdBased);
          if (pageId) onNavigate(pageId);
        },
      }),
      WikiLinkSuggestion.configure({
        suggestion: {
          items: ({ query }) =>
            pages
              .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 10)
              .map((p) => ({ id: p.id, label: p.title })),
          render: () => {
            let container: HTMLDivElement;

            return {
              onStart(props) {
                container = document.createElement('div');
                container.className = 'wiki-link-suggestions';
                renderSuggestionItems(container, props.items, (item) =>
                  props.command({ id: item.id, label: item.label }),
                );
                document.body.appendChild(container);
              },
              onUpdate(props) {
                renderSuggestionItems(container, props.items, (item) =>
                  props.command({ id: item.id, label: item.label }),
                );
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') return true;
                return false;
              },
              onExit() {
                container?.parentNode?.removeChild(container);
              },
            };
          },
        },
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      // @ts-ignore - tiptap-markdown adds getMarkdown to storage
      const markdown = e.storage.markdown.getMarkdown() as string;
      internalUpdateRef.current = true;
      onChange(markdown);
      slash.handleEditorUpdate();
    },
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleKeyDown: (view, event) => slashKeyDownRef.current(view, event),
    },
  });

  // Keep editorRef in sync for hooks that need it
  editorRef.current = editor;

  const bubbleMenu = useBubbleMenuDismiss(editor);

  // Highlight hover tooltip
  const hoverTooltip = useHighlightHoverTooltip({
    editor,
    containerRef: wrapperRef,
    readOnly,
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }
    // @ts-ignore
    const currentMarkdown = editor.storage.markdown.getMarkdown() as string;
    if (content !== currentMarkdown) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content, { emitUpdate: false });
      try { editor.commands.setTextSelection({ from, to }); } catch { /* position may be invalid */ }
    }
  }, [content, editor]);

  // Notify parent when editor is ready (once)
  useEffect(() => {
    if (editor && onEditorReady && !editorReadyCalledRef.current) {
      editorReadyCalledRef.current = true;
      onEditorReady(editor);
    }
  }, [editor]);

  if (!editor) {
    return <div className="tiptap-loading">Loading editor...</div>;
  }

  // --- Highlight operations ---

  const applyHighlight = (color: string) => {
    const id = crypto.randomUUID();
    editor.chain().focus().setHighlight({ id, color, style: highlightTab }).run();
    onHighlight?.(color, highlightTab);
  };

  const changeHighlightColor = (highlightId: string, newColor: string) => {
    const range = findHighlightRange(editor.state.doc, highlightId);
    if (!range) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: range.from, to: range.to })
      .setHighlight({ id: highlightId, color: newColor, style: range.style })
      .setTextSelection(range.from)
      .run();
    onHighlightChangeColor?.(highlightId, newColor);
  };

  const deleteHighlight = (highlightId: string) => {
    const range = findHighlightRange(editor.state.doc, highlightId);
    if (!range) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: range.from, to: range.to })
      .unsetHighlight()
      .setTextSelection(range.from)
      .run();
    onHighlightDelete?.(highlightId);
  };

  // --- Tooltip positioning ---

  const tooltipStyle = hoverTooltip.hoveredHighlight
    ? (() => {
        const { rect } = hoverTooltip.hoveredHighlight;
        const tooltipWidth = highlightColors.length * 28 + 60;
        const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8));
        const top = Math.max(8, rect.top - 44);
        return { top, left };
      })()
    : null;

  // --- Render ---

  return (
    <div className="tiptap-wrapper" ref={wrapperRef}>
      {/* Highlight hover tooltip */}
      {hoverTooltip.hoveredHighlight && tooltipStyle && createPortal(
        <HighlightTooltip
          colors={highlightColors}
          activeColor={hoverTooltip.hoveredHighlight.color}
          style={tooltipStyle}
          onChangeColor={(color) => {
            changeHighlightColor(hoverTooltip.hoveredHighlight!.id, color);
            hoverTooltip.dismiss();
          }}
          onDelete={() => {
            deleteHighlight(hoverTooltip.hoveredHighlight!.id);
            hoverTooltip.dismiss();
          }}
          onMouseEnter={hoverTooltip.onTooltipMouseEnter}
          onMouseLeave={hoverTooltip.onTooltipMouseLeave}
        />,
        document.body,
      )}

      {/* Slash command palette */}
      {slash.show && slash.filteredCommands.length > 0 && (
        <SlashPalette
          commands={slash.filteredCommands}
          selectedIndex={slash.selectedIndex}
          position={slash.palettePos}
          onSelect={(cmd) => slash.execute(cmd)}
        />
      )}

      {/* BubbleMenu on text selection */}
      {!readOnly && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          shouldShow={({ from, to }: { editor: Editor; from: number; to: number }) => {
            if (from === to) return false;
            if (editor.isActive('codeBlock')) return false;
            return true;
          }}
        >
          <div
            className="bubble-menu"
            ref={bubbleMenu.menuRef}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={bubbleMenu.onMenuMouseEnter}
          >
            <div className="bubble-menu-group">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'is-active' : ''}
                title="Bold (Cmd+B)"
              >
                <strong>B</strong>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'is-active' : ''}
                title="Italic (Cmd+I)"
              >
                <em>I</em>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? 'is-active' : ''}
                title="Code (Cmd+E)"
              >
                {'</>'}
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? 'is-active' : ''}
                title="Strikethrough"
              >
                <s>S</s>
              </button>
            </div>

            <div className="bubble-menu-divider" />

            <div className="bubble-menu-group bubble-menu-highlights">
              <div className="bubble-highlight-tabs">
                <button
                  className={`bubble-tab ${highlightTab === 'highlight' ? 'active' : ''}`}
                  onClick={() => setHighlightTab('highlight')}
                  title="Background highlight"
                >
                  Bg
                </button>
                <button
                  className={`bubble-tab ${highlightTab === 'underline' ? 'active' : ''}`}
                  onClick={() => setHighlightTab('underline')}
                  title="Underline"
                >
                  U̲
                </button>
              </div>
              {highlightColors.map((color) => {
                const previewColor =
                  highlightTab === 'highlight' ? getHighlightColor(color) : getUnderlineColor(color);
                return (
                  <button
                    key={color}
                    className="bubble-color-btn"
                    style={{ backgroundColor: previewColor }}
                    onClick={() => applyHighlight(color)}
                    title={`${highlightTab} color`}
                  />
                );
              })}
              <button
                className="bubble-remove-highlight"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editor.chain().focus().unsetMark('highlight').run();
                }}
                title="Remove Highlight"
              >
                ✕
              </button>
            </div>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

// --- Sub-components ---

function HighlightTooltip({
  colors,
  activeColor,
  style,
  onChangeColor,
  onDelete,
  onMouseEnter,
  onMouseLeave,
}: {
  colors: string[];
  activeColor: string;
  style: { top: number; left: number };
  onChangeColor: (color: string) => void;
  onDelete: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className="highlight-hover-tooltip"
      style={{ top: `${style.top}px`, left: `${style.left}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bubble-menu-group">
        {colors.map((color) => (
          <button
            key={color}
            className={`bubble-color-btn ${color === activeColor ? 'active' : ''}`}
            style={{ backgroundColor: getHighlightColor(color) }}
            onClick={() => onChangeColor(color)}
            title="Change color"
          />
        ))}
      </div>
      <div className="bubble-menu-divider" />
      <button className="bubble-delete-highlight" onClick={onDelete} title="Delete highlight">
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          delete
        </span>
      </button>
    </div>
  );
}

function SlashPalette({
  commands,
  selectedIndex,
  position,
  onSelect,
}: {
  commands: AppSlashCommand[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (cmd: AppSlashCommand) => void;
}) {
  const selectedRef = useCallback((el: HTMLDivElement | null) => {
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      className="slash-palette"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {commands.map((cmd, index) => (
        <div
          key={cmd.id}
          ref={index === selectedIndex ? selectedRef : undefined}
          className={`slash-palette-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd)}
        >
          <span className="slash-palette-icon">{cmd.icon}</span>
          <div className="slash-palette-info">
            <div className="slash-palette-label">{cmd.label}</div>
            <div className="slash-palette-key">/{cmd.key}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
