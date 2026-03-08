import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/types';
import { pageService, markdownService, saveImage, resolveImagesInHtml, clearImageCache } from '@/services';
import { useStore } from '@/store/useStore';
import { useSlashCommands, SlashCommandPalette } from '@/lib/slash-commands';
import { useMarkdownShortcuts } from '@/hooks/useMarkdownShortcuts';
import { useMermaid } from '@/hooks/useMermaid';
import { FindBar } from '@/components/FindBar';
import { openExternalUrl } from '@/lib/openExternal';
import TurndownService from 'turndown';
import './PageEditor.css';

function insertImageMarkdown(
  textarea: HTMLTextAreaElement,
  content: string,
  setContent: (s: string) => void,
  relativePath: string,
  fileName: string
) {
  const cursorPos = textarea.selectionStart;
  const imageMarkdown = `![${fileName}](${relativePath})\n`;
  const newContent = content.slice(0, cursorPos) + imageMarkdown + content.slice(cursorPos);
  setContent(newContent);
  const newCursor = cursorPos + imageMarkdown.length;
  requestAnimationFrame(() => {
    textarea.setSelectionRange(newCursor, newCursor);
    textarea.focus();
  });
}

export interface PageEditorHandle {
  save: () => void;
  togglePreview: () => void;
  openImagePicker: () => void;
  preview: boolean;
  saving: boolean;
}

interface PageEditorProps {
  page: Page;
  onSave: (updatedPage: Page) => void;
  onCancel: () => void;
  hideMeta?: boolean;
  hideToolbar?: boolean;
  metaOverrides?: { title: string; kanbanColumn: string; tags: string; dueDate: string };
  editorRef?: React.MutableRefObject<PageEditorHandle | null>;
}

export function PageEditor({ page, onSave, onCancel, hideMeta, hideToolbar, metaOverrides, editorRef }: PageEditorProps) {
  const navigate = useNavigate();
  const { updatePageInStore, pagesArray, slashCommands, columnColors } = useStore();
  const pages = pagesArray;
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(page.tags.join(', '));
  const [dueDate, setDueDate] = useState(page.dueDate ? page.dueDate.slice(0, 10) : '');
  const [selectedColumn, setSelectedColumn] = useState(page.kanbanColumn || '');
  const [newColumnInput, setNewColumnInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showToast, setShowToast] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorPreviewRef = useRef<HTMLDivElement>(null);
  const highlightOverlayRef = useRef<HTMLDivElement>(null);
  const [showFindBar, setShowFindBar] = useState(false);
  const [zoomedDiagram, setZoomedDiagram] = useState<string | null>(null);

  // Focus textarea at end of content when editor mounts
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, []);

  const slash = useSlashCommands({
    textareaRef,
    content,
    setContent,
    commands: slashCommands,
  });

  const markdown = useMarkdownShortcuts(textareaRef, content, setContent);

  // Render mermaid diagrams in editor preview
  useMermaid(previewRef, previewHtml);

  // Attach click handlers to internal links in preview mode for SPA navigation
  useEffect(() => {
    if (!preview) return;
    const container = previewRef.current;
    if (!container) return;

    const links = container.querySelectorAll<HTMLAnchorElement>('a[href^="/page/"]');
    const handlers: Array<(e: Event) => void> = [];

    links.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          const targetPageId = href.replace('/page/', '');
          // Only navigate if the target page is different from the current page
          if (targetPageId !== page.id) {
            navigate(href);
          }
        }
      };
      link.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      links.forEach((link, index) => {
        link.removeEventListener('click', handlers[index]);
      });
    };
  }, [preview, previewHtml, navigate, page.id]);

  // Attach click handlers to external links in preview mode to open in browser
  useEffect(() => {
    if (!preview) return;
    const container = previewRef.current;
    if (!container) return;

    const externalLinks = container.querySelectorAll<HTMLAnchorElement>('a[href^="http://"], a[href^="https://"]');
    const handlers: Array<(e: Event) => void> = [];

    externalLinks.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          openExternalUrl(href);
        }
      };
      link.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      externalLinks.forEach((link, index) => {
        link.removeEventListener('click', handlers[index]);
      });
    };
  }, [preview, previewHtml]);

  // Attach click handlers to mermaid diagrams in preview mode for zoom functionality
  useEffect(() => {
    if (!preview) return;
    const container = previewRef.current;
    if (!container) return;

    const diagrams = container.querySelectorAll<HTMLElement>('.mermaid-block');
    const handlers: Array<() => void> = [];

    diagrams.forEach((diagram) => {
      const handler = () => {
        const svg = diagram.querySelector('svg');
        if (svg) {
          setZoomedDiagram(svg.outerHTML);
        }
      };
      diagram.addEventListener('click', handler);
      handlers.push(handler);
    });

    return () => {
      diagrams.forEach((diagram, index) => {
        diagram.removeEventListener('click', handlers[index]);
      });
    };
  }, [preview, previewHtml]);

  // Handle copy events in preview mode to preserve markdown formatting
  useEffect(() => {
    if (!preview) return;
    const container = previewRef.current;
    if (!container) return;

    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      try {
        // Get the selected HTML
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const div = document.createElement('div');
        div.appendChild(fragment);
        let html = div.innerHTML;

        // Convert wiki-style links back to markdown format before turndown
        // <a class="page-link" data-page-ref="Title">Display</a> → [[Title|Display]]
        // <a class="page-link" data-page-id="id">Display</a> → [[id|Display]]
        html = html.replace(
          /<a[^>]*class="[^"]*page-link[^"]*"[^>]*data-page-(?:ref|id)="([^"]+)"[^>]*>([^<]+)<\/a>/g,
          (_match, ref, display) => {
            // If display text matches the reference, use short form [[ref]]
            if (display.trim() === ref.trim()) {
              return `[[${ref}]]`;
            }
            return `[[${ref}|${display}]]`;
          }
        );

        // Initialize Turndown with GitHub Flavored Markdown options
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          emDelimiter: '*',
        });

        // Add rule for mermaid code blocks
        turndownService.addRule('mermaid', {
          filter: (node) => {
            return node.nodeName === 'DIV' &&
                   node.classList.contains('mermaid-block');
          },
          replacement: (_content, node) => {
            const pre = (node as HTMLElement).querySelector('pre.mermaid');
            if (pre) {
              return '\n```mermaid\n' + pre.textContent + '\n```\n';
            }
            return '';
          }
        });

        // Add rule for checkboxes
        turndownService.addRule('taskList', {
          filter: (node) => {
            return node.nodeName === 'INPUT' &&
                   (node as HTMLInputElement).type === 'checkbox';
          },
          replacement: (_content, node) => {
            const checked = (node as HTMLInputElement).checked;
            return checked ? '[x]' : '[ ]';
          }
        });

        // Convert HTML to markdown
        const markdown = turndownService.turndown(html);

        // Put markdown in clipboard
        e.clipboardData?.setData('text/plain', markdown);
        e.preventDefault();
      } catch (error) {
        console.error('Failed to convert copied content to markdown:', error);
        // Let default copy behavior happen if conversion fails
      }
    };

    container.addEventListener('copy', handleCopy);
    return () => {
      container.removeEventListener('copy', handleCopy);
    };
  }, [preview]);

  // Derive existing columns from all pages' kanbanColumn values (case-insensitive dedup)
  const existingColumns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  const getColColor = (col: string) => columnColors[col.toLowerCase()];

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;

    // Try clipboardData.items first (Chrome/Blink)
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          try {
            const relativePath = await saveImage(page.path, file);
            insertImageMarkdown(textarea, content, setContent, relativePath, file.name || 'pasted-image');
          } catch (err) {
            console.error('Failed to save pasted image:', err);
            alert(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`);
          }
          return;
        }
      }
    }

    // Fallback: clipboardData.files (WebKit/WKWebView)
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          try {
            const relativePath = await saveImage(page.path, file);
            insertImageMarkdown(textarea, content, setContent, relativePath, file.name || 'pasted-image');
          } catch (err) {
            console.error('Failed to save pasted image:', err);
            alert(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`);
          }
          return;
        }
      }
    }
  }, [content, setContent, page.path]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        if (!textareaRef.current) return;
        try {
          const relativePath = await saveImage(page.path, file);
          insertImageMarkdown(textareaRef.current, content, setContent, relativePath, file.name);
        } catch (err) {
          console.error('Failed to save dropped image:', err);
          alert(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
    }
  }, [content, setContent, page.path]);

  const handleImageFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !textareaRef.current) return;
    try {
      const relativePath = await saveImage(page.path, file);
      insertImageMarkdown(textareaRef.current, content, setContent, relativePath, file.name);
    } catch (err) {
      console.error('Failed to save selected image:', err);
      alert(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`);
    }
    e.target.value = '';
  }, [content, setContent, page.path]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Expose methods to parent via editorRef
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        save: () => handleSave(),
        togglePreview: () => handlePreview(),
        openImagePicker,
        preview,
        saving,
      };
    }
    return () => {
      if (editorRef) editorRef.current = null;
    };
  });

  const handlePreview = useCallback(async () => {
    if (!preview) {
      // Convert wiki-style links before rendering markdown
      const { convertWikiLinksToMarkdown } = await import('@/utils/wikiLinks');
      const contentWithLinks = convertWikiLinksToMarkdown(content, pages);

      let html = await markdownService.toHtml(contentWithLinks);
      html = await resolveImagesInHtml(html, page.path);
      setPreviewHtml(html);
    }
    setPreview(!preview);
  }, [preview, content, page.path, pages]);

  // Clean up blob URLs on unmount — only when used standalone (not embedded in PageView)
  useEffect(() => {
    if (hideMeta) return; // Embedded in PageView — PageView manages the cache
    return () => { clearImageCache(); };
  }, []);

  const handleAddNewColumn = () => {
    const trimmed = newColumnInput.trim();
    if (!trimmed) return;
    setSelectedColumn(trimmed);
    setNewColumnInput('');
    setShowDropdown(false);
  };

  const handleNewColumnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewColumn();
    }
  };

  // Handle Tab indent, markdown shortcuts, and other keyboard shortcuts
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle markdown shortcuts (Cmd+B, Cmd+I, Cmd+E) first
    if (markdown.handleMarkdownShortcut(e)) return;

    // Handle Escape key (only when slash palette is not open) - save before exiting
    if (e.key === 'Escape' && !slash.isOpen) {
      e.preventDefault();
      handleSave();
      return;
    }

    // Handle Enter for auto list continuation when slash palette is NOT open
    if (e.key === 'Enter' && !slash.isOpen) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const beforeCursor = content.substring(0, start);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = beforeCursor.substring(lineStart);

      // Match list item: optional whitespace + bullet + optional checkbox + space
      const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s(\[[ x]\]\s)?/);
      if (listMatch) {
        e.preventDefault();
        const indent = listMatch[1];
        const bullet = listMatch[2];
        const checkbox = listMatch[3]; // e.g. "[ ] " or "[x] " or undefined
        const lineContent = currentLine.substring(listMatch[0].length);

        if (lineContent.trim() === '') {
          if (indent.length >= 2) {
            // Sublist: go up one level (remove 2 spaces of indent)
            const newIndent = indent.substring(2);
            const newLine = checkbox ? `${newIndent}${bullet} [ ] ` : `${newIndent}${bullet} `;
            const newContent = content.substring(0, lineStart) + newLine + content.substring(start);
            const newPos = lineStart + newLine.length;
            setContent(newContent);
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(newPos, newPos);
            });
          } else {
            // Top-level: exit the list (remove bullet, leave plain line)
            const newContent = content.substring(0, lineStart) + content.substring(start);
            setContent(newContent);
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(lineStart, lineStart);
            });
          }
        } else {
          // Has content: continue list with same indentation and bullet
          let nextBullet = bullet;
          if (/^\d+\.$/.test(bullet)) {
            nextBullet = `${parseInt(bullet) + 1}.`;
          }
          const checkboxPart = checkbox ? '[ ] ' : '';
          const insertion = `\n${indent}${nextBullet} ${checkboxPart}`;
          const newContent = content.substring(0, start) + insertion + content.substring(start);
          const newPos = start + insertion.length;
          setContent(newContent);
          requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
          });
        }
        return;
      }
    }

    // Handle Tab indent when slash palette is NOT open
    if (e.key === 'Tab' && !slash.isOpen) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSelection = start !== end;

      if (hasSelection) {
        // Multi-line indent/dedent
        const beforeSelection = content.substring(0, start);
        const afterSelection = content.substring(end);

        // Find start of first selected line
        const lineStart = beforeSelection.lastIndexOf('\n') + 1;
        const lineEnd = end;

        // Get all lines in selection
        const textToProcess = content.substring(lineStart, lineEnd);
        const lines = textToProcess.split('\n');

        if (e.shiftKey) {
          // Shift+Tab: dedent (remove up to 2 leading spaces from each line)
          const dedentedLines = lines.map(line => {
            if (line.startsWith('  ')) return line.substring(2);
            if (line.startsWith(' ')) return line.substring(1);
            return line;
          });
          const newText = dedentedLines.join('\n');
          const newContent = content.substring(0, lineStart) + newText + afterSelection;
          setContent(newContent);

          // Restore selection
          setTimeout(() => {
            textarea.focus();
            const newStart = start - (lineStart === start ? Math.min(2, lines[0].length - dedentedLines[0].length) : 0);
            const lengthDiff = textToProcess.length - newText.length;
            textarea.setSelectionRange(newStart, end - lengthDiff);
          }, 0);
        } else {
          // Tab: indent (add 2 spaces to each line)
          const indentedLines = lines.map(line => '  ' + line);
          const newText = indentedLines.join('\n');
          const newContent = content.substring(0, lineStart) + newText + afterSelection;
          setContent(newContent);

          // Restore selection
          setTimeout(() => {
            textarea.focus();
            const spacesAdded = lines.length * 2;
            const newStart = start + (lineStart === start ? 2 : 0);
            textarea.setSelectionRange(newStart, end + spacesAdded);
          }, 0);
        }
      } else if (e.shiftKey) {
        // Shift+Tab: dedent current line (remove up to 2 leading spaces)
        const beforeCursor = content.substring(0, start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const lineEnd = content.indexOf('\n', start);
        const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

        if (currentLine.startsWith('  ')) {
          const newLine = currentLine.substring(2);
          const newContent = content.substring(0, lineStart) + newLine + (lineEnd === -1 ? '' : content.substring(lineEnd));
          setContent(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, start - 2));
          }, 0);
        } else if (currentLine.startsWith(' ')) {
          const newLine = currentLine.substring(1);
          const newContent = content.substring(0, lineStart) + newLine + (lineEnd === -1 ? '' : content.substring(lineEnd));
          setContent(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(Math.max(lineStart, start - 1), Math.max(lineStart, start - 1));
          }, 0);
        }
      } else {
        // Tab: if on a list item line, indent the whole line; otherwise insert 2 spaces at cursor
        const beforeCursor = content.substring(0, start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const lineEnd = content.indexOf('\n', start);
        const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

        if (/^\s*([-*+]|\d+\.)\s/.test(currentLine)) {
          // Indent entire list line by 2 spaces
          const newLine = '  ' + currentLine;
          const newContent = content.substring(0, lineStart) + newLine + (lineEnd === -1 ? '' : content.substring(lineEnd));
          setContent(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 2, start + 2);
          }, 0);
        } else {
          // Non-list line: insert 2 spaces at cursor
          const newContent = content.substring(0, start) + '  ' + content.substring(end);
          setContent(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 2, start + 2);
          }, 0);
        }
      }
      return;
    }

    // Delegate to slash commands handler
    slash.handleKeyDown(e);
  };

  // Keyboard shortcut: Ctrl+S to save, Cmd+F for find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindBar(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, content, tags, dueDate, selectedColumn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const meta = metaOverrides;
      const finalTitle = meta ? meta.title.trim() || page.title : title.trim() || page.title;
      const finalTags = meta ? meta.tags.split(',').map(t => t.trim()).filter(Boolean) : tags.split(',').map(t => t.trim()).filter(Boolean);
      const finalDueDate = meta ? meta.dueDate : dueDate;
      const finalColumn = meta ? meta.kanbanColumn : selectedColumn;
      const updatedPage: Page = {
        ...page,
        title: finalTitle,
        content,
        tags: finalTags,
        dueDate: finalDueDate ? new Date(finalDueDate).toISOString() : undefined,
        kanbanColumn: finalColumn || undefined,
      };

      await pageService.updatePage(updatedPage);
      updatePageInStore(updatedPage);
      onSave(updatedPage);

      // Show success toast
      console.log('Showing toast...');
      setShowToast(true);
      setTimeout(() => {
        console.log('Hiding toast...');
        setShowToast(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to save page:', error);
      alert('Failed to save page. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showToast && (
        <div className="toast-notification">
          <span className="material-symbols-outlined">check_circle</span>
          <span>Saved successfully!</span>
        </div>
      )}
      <div className="page-editor">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFileSelect}
        />
        {!hideToolbar && (
        <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <button
            className={`toolbar-btn ${!preview ? 'active' : ''}`}
            onClick={() => setPreview(false)}
          >
            Edit
          </button>
          <button
            className={`toolbar-btn ${preview ? 'active' : ''}`}
            onClick={handlePreview}
          >
            Preview
          </button>
          <button className="toolbar-btn" onClick={openImagePicker} title="Insert image">
            <span className="material-symbols-outlined" style={{fontSize: '1.1rem'}}>image</span>
          </button>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
        )}

      {!hideMeta && <div className="editor-meta">
        <div className="editor-field">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="editor-title-input"
            placeholder="Untitled"
          />
        </div>
        <div className="editor-props">
          <div className="editor-prop-row">
            <span className="editor-prop-label">
              <span className="material-symbols-outlined">view_column</span>
              Column
            </span>
            <div className="editor-prop-value">
              <div className="column-selector" ref={dropdownRef}>
                <div
                  className="column-selector-display"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  {selectedColumn ? (
                    <span
                      className="selected-column-chip"
                      style={getColColor(selectedColumn) ? { backgroundColor: getColColor(selectedColumn) } : undefined}
                    >
                      {selectedColumn}
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColumn('');
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <span className="column-placeholder">Empty</span>
                  )}
                </div>

                {showDropdown && (
                  <div className="column-dropdown">
                    {existingColumns.length > 0 && (
                      <div className="column-chips">
                        {existingColumns.map(col => (
                          <button
                            key={col}
                            type="button"
                            className={`column-chip ${selectedColumn === col ? 'active' : ''}`}
                            style={getColColor(col)
                              ? selectedColumn === col
                                ? { backgroundColor: getColColor(col), color: 'white', borderColor: 'transparent' }
                                : { borderColor: getColColor(col), color: getColColor(col) }
                              : undefined}
                            onClick={() => {
                              setSelectedColumn(col);
                              setShowDropdown(false);
                            }}
                          >
                            {col}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="column-new-input">
                      <input
                        type="text"
                        value={newColumnInput}
                        onChange={e => setNewColumnInput(e.target.value)}
                        onKeyDown={handleNewColumnKeyDown}
                        placeholder="New column..."
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleAddNewColumn}
                        disabled={!newColumnInput.trim()}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="editor-prop-row">
            <span className="editor-prop-label">
              <span className="material-symbols-outlined">sell</span>
              Tags
            </span>
            <div className="editor-prop-value">
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="Empty"
              />
            </div>
          </div>
          <div className="editor-prop-row">
            <span className="editor-prop-label">
              <span className="material-symbols-outlined">calendar_today</span>
              Due Date
            </span>
            <div className="editor-prop-value">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>}

      {preview ? (
        <div ref={editorPreviewRef}>
          {showFindBar && (
            <FindBar
              content={content}
              contentRef={previewRef}
              onClose={() => setShowFindBar(false)}
            />
          )}
          <div
            ref={previewRef}
            className="editor-preview markdown-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      ) : (
        <div
          className="editor-textarea-wrapper"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {showFindBar && (
            <FindBar
              content={content}
              textareaRef={textareaRef}
              contentRef={previewRef}
              highlightOverlayRef={highlightOverlayRef}
              onClose={() => setShowFindBar(false)}
            />
          )}
          {slash.isOpen && slash.palettePosition && (
            <SlashCommandPalette
              commands={slash.filteredCommands}
              selectedIndex={slash.selectedIndex}
              position={slash.palettePosition}
              onSelect={slash.executeCommand}
              onClose={slash.closePalette}
            />
          )}
          <div className="textarea-highlight-container">
            <div
              ref={highlightOverlayRef}
              className="textarea-highlight-overlay"
              aria-hidden="true"
            />
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={content}
              onChange={slash.handleChange}
              onKeyDown={handleEditorKeyDown}
              onCompositionStart={slash.handleCompositionStart}
              onCompositionEnd={slash.handleCompositionEnd}
              onBlur={slash.handleBlur}
              onPaste={handlePaste}
              onScroll={(e) => {
                // Sync scroll with highlight overlay
                if (highlightOverlayRef.current) {
                  highlightOverlayRef.current.scrollTop = e.currentTarget.scrollTop;
                  highlightOverlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
              placeholder="Type / for commands, or start writing..."
              spellCheck
            />
          </div>
        </div>
      )}
      </div>

      {/* Mermaid diagram zoom modal */}
      {zoomedDiagram && (
        <div
          className="diagram-zoom-modal"
          onClick={() => setZoomedDiagram(null)}
        >
          <div
            className="diagram-zoom-content"
            dangerouslySetInnerHTML={{ __html: zoomedDiagram }}
          />
        </div>
      )}
    </>
  );
}
