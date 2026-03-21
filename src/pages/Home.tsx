import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '@/store/useStore';
import { fileSystemService, pageService, markdownService, resolveImagesInHtml } from '@/services';
import { Button, ButtonGroup } from '@/components/Button';
import { CreatePageModal } from '@/components/CreatePageModal';
import { CreateTodoModal } from '@/components/CreateTodoModal';
import { ContextMenu } from '@/components/ContextMenu';
import { TooltipWindow } from '@/components/TooltipWindow';
import { RecentlyEdited } from '@/components/RecentlyEdited';
import './Home.css';

const DEFAULT_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const isTauri = '__TAURI_INTERNALS__' in window;

export function Home() {
  const {
    hasFileSystemAccess, setHasFileSystemAccess,
    pagesArray, setPages, updatePageInStore, columnColors,
    columnOrder, setColumnOrder,
    boardDensity,
    boardView, setBoardView,
  } = useStore();
  const pages = pagesArray;
  const [listSortField, setListSortField] = useState<'title' | 'createdAt' | 'dueDate' | 'kanbanColumn'>('title');
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string } | null>(null);
  const [previewCard, setPreviewCard] = useState<{ id: string; html: string; rect: DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 'idle' = checking, 'prompt' = needs user click, 'none' = no saved handle
  const [restoreState, setRestoreState] = useState<'idle' | 'prompt' | 'none'>('idle');

  // Load pages function
  const loadPages = useCallback(async () => {
    if (!hasFileSystemAccess) return;

    try {
      const allPages = await pageService.getAllPages();
      setPages(allPages);
    } catch (error) {
      console.error('Failed to load pages:', error);
    }
  }, [hasFileSystemAccess, setPages]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPages();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Listen for workspace changes (Tauri only)
  useEffect(() => {
    if (!isTauri || !hasFileSystemAccess) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen('workspace-changed', async () => {
          await loadPages();
        });
      } catch (err) {
        console.error('Failed to setup workspace listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [hasFileSystemAccess, loadPages]);

  // Load pages when file system access is granted
  useEffect(() => {
    if (hasFileSystemAccess) {
      loadPages();
    }
  }, [hasFileSystemAccess, loadPages]);

  // Check if a previously saved handle can be reconnected
  useEffect(() => {
    if (hasFileSystemAccess) return;

    const check = async () => {
      const result = await fileSystemService.tryRestore();
      if (result === 'granted') {
        setHasFileSystemAccess(true);
      } else if (result === 'prompt') {
        setRestoreState('prompt');
      } else {
        setRestoreState('none');
      }
    };
    check();
  }, [hasFileSystemAccess]);

  const handleSelectFolder = async () => {
    try {
      await fileSystemService.requestDirectoryAccess();
      setHasFileSystemAccess(true);
    } catch (error) {
      console.error('Failed to access file system:', error);
      alert('Failed to access folder. Please try again.');
    }
  };

  const handleReconnect = async () => {
    const granted = await fileSystemService.requestRestoredPermission();
    if (granted) {
      setHasFileSystemAccess(true);
    } else {
      // Permission denied, fall back to full folder picker
      setRestoreState('none');
    }
  };

  // Ref to access latest pages in callbacks without re-creating them
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // O(n) page lookup map — avoids repeated pages.find() in handlers
  const pageMap = useMemo(() => {
    const map = new Map<string, typeof pages[number]>();
    for (const p of pages) map.set(p.id, p);
    return map;
  }, [pages]);

  // Filter root-level pages (no parentId) for Home Kanban board
  const rootPages = useMemo(() => pages.filter(p => !p.parentId), [pages]);

  // Derive columns from all unique kanbanColumn values (case-insensitive dedup)
  const unsortedColumns = useMemo(() => Array.from(
    rootPages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  ), [rootPages]);

  // Sort columns by persisted order; unknown columns go to the end
  const columns = useMemo(() => [...unsortedColumns].sort((a, b) => {
    const aIdx = columnOrder.indexOf(a.toLowerCase());
    const bIdx = columnOrder.indexOf(b.toLowerCase());
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  }), [unsortedColumns, columnOrder]);

  // Create a stable color mapping based on alphabetically sorted columns
  const sortedColumnNames = useMemo(
    () => [...unsortedColumns].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    [unsortedColumns]
  );
  const getColumnColor = useCallback((columnName: string) => {
    const customColor = columnColors[columnName.toLowerCase()];
    if (customColor) return customColor;
    const stableIndex = sortedColumnNames.findIndex(c => c.toLowerCase() === columnName.toLowerCase());
    return DEFAULT_PALETTE[stableIndex % DEFAULT_PALETTE.length];
  }, [columnColors, sortedColumnNames]);

  // Pre-sort function for cards (pinned first, then by createdAt)
  const sortCards = useCallback((cards: typeof rootPages) => {
    return [...cards].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) return (b.pinnedAt || '').localeCompare(a.pinnedAt || '');
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, []);

  // Pre-group and sort cards by column — O(n) grouping instead of O(columns × pages) filtering
  const columnCardsMap = useMemo(() => {
    const map = new Map<string, typeof rootPages>();
    const uncategorized: typeof rootPages = [];

    for (const page of rootPages) {
      if (page.kanbanColumn) {
        const key = page.kanbanColumn.toLowerCase();
        const arr = map.get(key);
        if (arr) arr.push(page);
        else map.set(key, [page]);
      } else {
        uncategorized.push(page);
      }
    }

    // Sort each group
    for (const [key, cards] of map) {
      map.set(key, sortCards(cards));
    }
    map.set('__uncategorized__', sortCards(uncategorized));

    return map;
  }, [rootPages, sortCards]);

  const uncategorizedCards = columnCardsMap.get('__uncategorized__') || [];
  const hasUncategorized = uncategorizedCards.length > 0;

  // Pre-sort for list view
  const sortedListPages = useMemo(() => {
    const sorted = [...rootPages];
    sorted.sort((a, b) => {
      let aVal: string | undefined;
      let bVal: string | undefined;
      if (listSortField === 'kanbanColumn') {
        aVal = a.kanbanColumn?.toLowerCase() || '';
        bVal = b.kanbanColumn?.toLowerCase() || '';
      } else {
        aVal = a[listSortField] || '';
        bVal = b[listSortField] || '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return listSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rootPages, listSortField, listSortDir]);

  if (!hasFileSystemAccess) {
    // Still checking IndexedDB
    if (restoreState === 'idle') {
      return (
        <div className="home">
          <div className="home-empty">
            <p>Loading workspace...</p>
          </div>
        </div>
      );
    }

    // Saved handle exists but needs user gesture to re-grant permission
    if (restoreState === 'prompt') {
      return (
        <div className="home">
          <div className="welcome-card">
            <h1>Welcome back</h1>
            <p className="welcome-text">
              Your workspace folder was disconnected after the page refresh.
              Click below to reconnect.
            </p>

            <button onClick={handleReconnect} className="btn btn-primary btn-large">
              Reconnect Workspace
            </button>

            <p className="help-text">
              Or{' '}
              <button className="link-btn" onClick={handleSelectFolder}>
                select a different folder
              </button>
            </p>
          </div>
        </div>
      );
    }

    // No saved handle — first-time welcome
    return (
      <div className="home">
        <div className="welcome-card">
          <h1>Welcome to Pale Blue Dot 🌍</h1>
          <p className="welcome-text">
            A contemplative, local file-based knowledge manager inspired by Carl Sagan's Pale Blue Dot.
            All your data is stored locally and can be tracked with git.
          </p>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">📋</span>
              <h3>Kanban Workflow</h3>
              <p>Organize pages into columns with drag & drop</p>
            </div>
            <div className="feature">
              <span className="feature-icon">✍️</span>
              <h3>Notion-Style Pages</h3>
              <p>Write with rich markdown and wiki-style links</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🏷️</span>
              <h3>Tags & Hierarchy</h3>
              <p>Organize with tags, nested pages, and filters</p>
            </div>
          </div>

          <button onClick={handleSelectFolder} className="btn btn-primary btn-large">
            Select Workspace Folder
          </button>

          <p className="help-text">
            Choose a folder where your workspace will be stored.
            The app will create a &quot;workspace&quot; subfolder to organize your pages.
          </p>
        </div>
      </div>
    );
  }

  // --- Card drag & drop ---
  const handleDragStart = (cardId: string, e: React.DragEvent) => {
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/card', cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  // --- Column drag & drop ---
  const handleColumnDragStart = (col: string, e: React.DragEvent) => {
    setDraggedColumn(col);
    e.dataTransfer.setData('text/column', col);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    // Only accept column drags, not card drags
    if (draggedColumn) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleColumnDrop = (targetCol: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedColumn || draggedColumn === targetCol) {
      setDraggedColumn(null);
      return;
    }

    // Build a full order list from the current columns (lowercase keys)
    const currentOrder = columns.map(c => c.toLowerCase());
    const fromIdx = currentOrder.indexOf(draggedColumn.toLowerCase());
    const toIdx = currentOrder.indexOf(targetCol.toLowerCase());
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedColumn.toLowerCase());
    setColumnOrder(newOrder);
    setDraggedColumn(null);
  };

  const handleDrop = async (columnTag: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId) return;

    const card = pageMap.get(draggedCardId);
    if (!card || card.kanbanColumn?.toLowerCase() === columnTag.toLowerCase()) {
      setDraggedCardId(null);
      return;
    }

    const updatedCard = { ...card, kanbanColumn: columnTag };

    try {
      // Use metadata-only update for better performance
      await pageService.updatePageMetadata(card.path, { kanbanColumn: columnTag });
      updatePageInStore(updatedCard);
    } catch (error) {
      console.error('Failed to move card:', error);
    }

    setDraggedCardId(null);
  };

  const handleDropUncategorized = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId) return;

    const card = pageMap.get(draggedCardId);
    if (!card || !card.kanbanColumn) {
      setDraggedCardId(null);
      return;
    }

    const updatedCard = { ...card, kanbanColumn: undefined };

    try {
      // Use metadata-only update for better performance
      await pageService.updatePageMetadata(card.path, { kanbanColumn: undefined });
      updatePageInStore(updatedCard);
    } catch (error) {
      console.error('Failed to move card:', error);
    }

    setDraggedCardId(null);
  };

  // Pin/Unpin card
  const handleTogglePin = async (cardId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const card = pageMap.get(cardId);
    if (!card) return;

    const newPinned = !card.pinned;
    const updatedCard = {
      ...card,
      pinned: newPinned,
      pinnedAt: newPinned ? new Date().toISOString() : undefined,
    };

    try {
      // Use metadata-only update for better performance
      await pageService.updatePageMetadata(card.path, {
        pinned: newPinned,
        pinnedAt: newPinned ? updatedCard.pinnedAt : undefined,
      });
      updatePageInStore(updatedCard);
    } catch (error) {
      console.error('Failed to pin/unpin card:', error);
    }
  };

  // Hover preview handlers
  const handleCardMouseEnter = (card: { id: string; content: string; title?: string }, e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (!card.content.trim()) return;
    const target = e.currentTarget as HTMLElement;

    // Capture position immediately (not after timeout)
    const rect = target.getBoundingClientRect();

    hoverTimerRef.current = setTimeout(async () => {
      let html = await markdownService.toHtml(card.content);
      const pg = pageMap.get(card.id);
      if (pg) {
        html = await resolveImagesInHtml(html, pg.path);
      }
      setPreviewCard({ id: card.id, html, rect });
    }, 350);
  };

  const handleCardMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setPreviewCard(null);
  };

  // Context menu handlers
  const handleCardContextMenu = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pageId });
  };

  const handleCopyLink = async (pageId: string) => {
    const link = `${window.location.origin}/page/${pageId}`;
    try {
      await navigator.clipboard.writeText(link);
      // You could add a toast notification here
      console.log('Link copied to clipboard:', link);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // No pages and no columns yet
  if (pages.length === 0) {
    return (
      <div className="home">
        <div className="home-empty">
          <h2>No pages yet</h2>
          <p>Create your first page to get started.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary new-page-btn" onClick={() => setShowTodoModal(true)}>
              <span className="material-symbols-outlined">check_circle</span>
              Todo
            </button>
            <button className="btn btn-primary new-page-btn" onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined">add_circle</span>
              New Page
            </button>
          </div>
          {showCreateModal && (
            <CreatePageModal onClose={() => setShowCreateModal(false)} />
          )}
          {showTodoModal && (
            <CreateTodoModal onClose={() => setShowTodoModal(false)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="home-board">
      <div className="board-header">
        <div className="board-header-row">
          <ButtonGroup spacing="compact" className="board-view-tabs">
            <Button
              variant={boardView === 'kanban' ? 'secondary' : 'ghost'}
              onClick={() => setBoardView('kanban')}
              icon={<span className="material-symbols-outlined">view_kanban</span>}
              title="Board View"
            />
            <Button
              variant={boardView === 'list' ? 'secondary' : 'ghost'}
              onClick={() => setBoardView('list')}
              icon={<span className="material-symbols-outlined">list</span>}
              title="List View"
            />
            <Button
              variant={boardView === 'compact' ? 'secondary' : 'ghost'}
              onClick={() => setBoardView('compact')}
              icon={<span className="material-symbols-outlined">grid_view</span>}
              title="Compact View"
            />
          </ButtonGroup>
          <ButtonGroup spacing="compact" className="board-actions-right">
            <Button
              variant="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh pages from workspace"
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ animation: isRefreshing ? 'spin 0.5s linear infinite' : 'none' }}
                >
                  refresh
                </span>
              }
            />
            <Button
              variant="icon"
              onClick={() => setShowTodoModal(true)}
              icon={<span className="material-symbols-outlined">check_box</span>}
              title="Create Todo"
            />
            <Button
              variant="icon"
              onClick={() => setShowCreateModal(true)}
              icon={<span className="material-symbols-outlined">note_add</span>}
              title="New Page"
            />
          </ButtonGroup>
        </div>
        <RecentlyEdited />
      </div>

      {boardView === 'compact' ? (
        /* ===== COMPACT GRID VIEW - Pale Blue Dot (No rainbow colors!) ===== */
        <div className="compact-grid-view">
          {columns.map((col) => {
            const columnCards = columnCardsMap.get(col.toLowerCase()) || [];
            return (
              <div key={col} className="compact-column">
                <div className="compact-column-header">
                  <h4>{col}</h4>
                  <span className="compact-card-count">{columnCards.length}</span>
                </div>
                <div className="compact-column-list">
                  {columnCards.map(card => (
                    <Link
                      key={card.id}
                      to={`/page/${card.id}`}
                      className="compact-card-item"
                    >
                      {card.pinned && <span className="compact-pin-indicator material-symbols-outlined">keep</span>}
                      <span className="compact-card-title">{card.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {hasUncategorized && (
            <div className="compact-column">
              <div className="compact-column-header">
                <h4>Uncategorized</h4>
                <span className="compact-card-count">{uncategorizedCards.length}</span>
              </div>
              <div className="compact-column-list">
                {uncategorizedCards.map(card => (
                  <Link
                    key={card.id}
                    to={`/page/${card.id}`}
                    className="compact-card-item"
                  >
                    {card.pinned && <span className="compact-pin-indicator material-symbols-outlined">keep</span>}
                    <span className="compact-card-title">{card.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : boardView === 'kanban' ? (
        <div className="kanban-board">
          {columns.map((col) => {
            const columnCards = columnCardsMap.get(col.toLowerCase()) || [];
            const color = getColumnColor(col);
            return (
              <div
                key={col}
                className={`kanban-column ${boardDensity === 'compact' ? 'compact-density' : ''} ${draggedCardId ? 'droppable' : ''} ${draggedColumn === col ? 'column-dragging' : ''} ${draggedColumn && draggedColumn !== col ? 'column-drop-target' : ''}`}
                style={{ borderTopColor: color }}
                onDragOver={(e) => { handleDragOver(e); handleColumnDragOver(e); }}
                onDrop={(e) => { if (draggedColumn) handleColumnDrop(col, e); else handleDrop(col, e); }}
              >
                <div
                  className="column-header"
                  style={{ borderTopColor: color }}
                  draggable
                  onDragStart={(e) => handleColumnDragStart(col, e)}
                  onDragEnd={() => setDraggedColumn(null)}
                >
                  <h3><span className="material-symbols-outlined column-drag-handle">drag_indicator</span>{col}</h3>
                  <span className="card-count">{columnCards.length}</span>
                </div>
                <div className="column-content">
                  {columnCards.map(card => {
                    const dueDateClass = card.dueDate ? (() => {
                      const diff = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000);
                      return diff < 0 ? 'overdue' : diff <= 3 ? 'due-soon' : '';
                    })() : '';
                    return (
                    <div
                      key={card.id}
                      className={`kanban-card ${draggedCardId === card.id ? 'dragging' : ''} ${card.pinned ? 'pinned' : ''}`}
                      style={{ '--card-accent': color } as React.CSSProperties}
                      draggable
                      onDragStart={(e) => handleDragStart(card.id, e)}
                      onDragEnd={() => setDraggedCardId(null)}
                      onContextMenu={(e) => handleCardContextMenu(e, card.id)}
                      onMouseEnter={(e) => handleCardMouseEnter(card, e)}
                      onMouseLeave={handleCardMouseLeave}
                    >
                      <button
                        className={`pin-btn ${card.pinned ? 'pinned' : ''}`}
                        onClick={(e) => handleTogglePin(card.id, e)}
                        onMouseEnter={handleCardMouseLeave}
                        title={card.pinned ? 'Unpin from top' : 'Pin to top'}
                      >
                        <span className="material-symbols-outlined">
                          {card.pinned ? 'keep' : 'keep_off'}
                        </span>
                      </button>
                      <Link to={`/page/${card.id}`} className="card-link">
                        <h4>{card.title}</h4>
                        {card.dueDate && (
                          <div className={`card-due ${dueDateClass}`}>
                            <span className="material-symbols-outlined">schedule</span>
                            {new Date(card.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        {card.tags && card.tags.length > 0 && (
                          <div className="card-tags">
                            {card.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="card-tag">{tag}</span>
                            ))}
                          </div>
                        )}
                        <p className="card-excerpt">
                          {markdownService.getExcerpt(card.content)}
                        </p>
                      </Link>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {hasUncategorized && (
            <div
              className={`kanban-column ${boardDensity === 'compact' ? 'compact-density' : ''} ${draggedCardId ? 'droppable' : ''}`}
              style={{ borderTopColor: '#6b7280' }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropUncategorized(e)}
            >
              <div className="column-header" style={{ borderTopColor: '#6b7280' }}>
                <h3>Uncategorized</h3>
                <span className="card-count">
                  {uncategorizedCards.length}
                </span>
              </div>
              <div className="column-content">
                {uncategorizedCards.map(card => {
                    const dueDateClass = card.dueDate ? (() => {
                      const diff = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000);
                      return diff < 0 ? 'overdue' : diff <= 3 ? 'due-soon' : '';
                    })() : '';
                    return (
                    <div
                      key={card.id}
                      className={`kanban-card ${draggedCardId === card.id ? 'dragging' : ''} ${card.pinned ? 'pinned' : ''}`}
                      style={{ '--card-accent': '#6b7280' } as React.CSSProperties}
                      draggable
                      onDragStart={(e) => handleDragStart(card.id, e)}
                      onDragEnd={() => setDraggedCardId(null)}
                      onContextMenu={(e) => handleCardContextMenu(e, card.id)}
                      onMouseEnter={(e) => handleCardMouseEnter(card, e)}
                      onMouseLeave={handleCardMouseLeave}
                    >
                      <button
                        className={`pin-btn ${card.pinned ? 'pinned' : ''}`}
                        onClick={(e) => handleTogglePin(card.id, e)}
                        onMouseEnter={handleCardMouseLeave}
                        title={card.pinned ? 'Unpin from top' : 'Pin to top'}
                      >
                        <span className="material-symbols-outlined">
                          {card.pinned ? 'keep' : 'keep_off'}
                        </span>
                      </button>
                      <Link to={`/page/${card.id}`} className="card-link">
                        <h4>{card.title}</h4>
                        {card.dueDate && (
                          <div className={`card-due ${dueDateClass}`}>
                            <span className="material-symbols-outlined">schedule</span>
                            {new Date(card.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        {card.tags && card.tags.length > 0 && (
                          <div className="card-tags">
                            {card.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="card-tag">{tag}</span>
                            ))}
                          </div>
                        )}
                        <p className="card-excerpt">
                          {markdownService.getExcerpt(card.content)}
                        </p>
                      </Link>
                    </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===== LIST VIEW ===== */
        <div className="list-view">
          <div className="list-view-header">
            <span
              className={`list-col-header sortable ${listSortField === 'title' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'title') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('title'); setListSortDir('asc'); }
              }}
            >
              Title {listSortField === 'title' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
            <span
              className={`list-col-header sortable ${listSortField === 'kanbanColumn' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'kanbanColumn') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('kanbanColumn'); setListSortDir('asc'); }
              }}
            >
              Column {listSortField === 'kanbanColumn' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
            <span
              className={`list-col-header sortable ${listSortField === 'dueDate' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'dueDate') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('dueDate'); setListSortDir('asc'); }
              }}
            >
              Due Date {listSortField === 'dueDate' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
            <span
              className={`list-col-header sortable ${listSortField === 'createdAt' ? 'active' : ''}`}
              onClick={() => {
                if (listSortField === 'createdAt') setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setListSortField('createdAt'); setListSortDir('desc'); }
              }}
            >
              Created {listSortField === 'createdAt' ? (listSortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
          </div>
          {(() => {
            return sortedListPages.length > 0 ? sortedListPages.map(page => (
              <Link key={page.id} to={`/page/${page.id}`} className="list-row">
                <span className="list-cell list-cell-title">{page.title}</span>
                <span className="list-cell">
                  {page.kanbanColumn && (
                    <span className="tag-small" style={{ backgroundColor: getColumnColor(page.kanbanColumn), color: 'white' }}>
                      {page.kanbanColumn}
                    </span>
                  )}
                </span>
                <span className="list-cell list-cell-date">
                  {page.dueDate ? new Date(page.dueDate).toLocaleDateString() : '—'}
                </span>
                <span className="list-cell list-cell-date">
                  {new Date(page.createdAt).toLocaleDateString()}
                </span>
              </Link>
            )) : (
              <div className="list-empty">No pages yet</div>
            );
          })()}
        </div>
      )}

      {previewCard && (
        <TooltipWindow anchorRect={previewCard.rect} placement="left" width={320} maxHeight={500}>
          <div
            className="card-hover-preview markdown-content"
            dangerouslySetInnerHTML={{ __html: previewCard.html }}
          />
        </TooltipWindow>
      )}

      {showCreateModal && (
        <CreatePageModal onClose={() => {
          setShowCreateModal(false);
          // Refresh pages after modal closes
          setTimeout(() => loadPages(), 100);
        }} />
      )}
      {showTodoModal && (
        <CreateTodoModal onClose={() => {
          setShowTodoModal(false);
          // Refresh pages after modal closes
          setTimeout(() => loadPages(), 100);
        }} />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Copy Link',
              icon: 'link',
              onClick: () => handleCopyLink(contextMenu.pageId),
            },
          ]}
        />
      )}
    </div>
  );
}
