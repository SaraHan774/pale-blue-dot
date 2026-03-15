import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '@/store/useStore';
import { pageService, fileSystemService } from '@/services';
import { CreatePageModal } from './CreatePageModal';
import { PaleBlueDotLogo } from './PaleBlueDotLogo';
import './Sidebar.css';

// Tauri detection
const isTauri = '__TAURI_INTERNALS__' in window;

const DEFAULT_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const PAGE_BATCH_SIZE = 50;

export function Sidebar() {
  const { pagesArray, setPages, hasFileSystemAccess, setSidebarOpen, activeFilters, setActiveFilters, sortOptions, setSortOptions, loadSettingsFromFile, columnColors, sidebarWidth, setSidebarWidth } = useStore();
  const pages = pagesArray;
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>();
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState(activeFilters.searchText);
  const [debouncedSearchText, setDebouncedSearchText] = useState(activeFilters.searchText);
  const [isResizing, setIsResizing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH_SIZE);
  const [showTagFilters, setShowTagFilters] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasFileSystemAccess) {
      loadSettingsFromFile();
      loadPages();
    }
  }, [hasFileSystemAccess]);

  const loadPages = async () => {
    setLoading(true);
    try {
      const allPages = await pageService.getAllPages();
      setPages(allPages);
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Start watching workspace for file changes (Tauri only)
  useEffect(() => {
    if (!isTauri || !hasFileSystemAccess) return;

    const startWatching = async () => {
      try {
        const rootHandle = fileSystemService.getRootHandle();
        if (typeof rootHandle === 'string') {
          const workspacePath = `${rootHandle}/workspace`;
          await invoke('watch_workspace', { workspacePath });
        }
      } catch (err) {
        console.error('Failed to start workspace watcher:', err);
      }
    };

    startWatching();
  }, [hasFileSystemAccess]);

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
        console.error('Failed to setup workspace change listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [hasFileSystemAccess]);

  const handleSearch = (value: string) => {
    setSearchText(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchText(value);
      setActiveFilters({ ...activeFilters, searchText: value });
      setVisibleCount(PAGE_BATCH_SIZE);
    }, 300);
  };

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Reset visible count when filters/sort change
  useEffect(() => {
    setVisibleCount(PAGE_BATCH_SIZE);
  }, [activeFilters.tags, sortOptions]);

  const toggleCollapse = (pageId: string) => {
    setCollapsedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  // Sidebar resize handlers
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const collapseAll = () => {
    const allPageIds = pages.map(p => p.id);
    setCollapsedPages(new Set(allPageIds));
  };

  const expandAll = () => {
    setCollapsedPages(new Set());
  };

  const handleCreateSubPage = (parentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCreateParentId(parentId);
    setShowCreateModal(true);
  };

  const filteredPages = useMemo(() => {
    const result = pages.filter(page => {
      if (debouncedSearchText) {
        const s = debouncedSearchText.toLowerCase();
        if (!page.title.toLowerCase().includes(s) && !page.content.toLowerCase().includes(s)) {
          return false;
        }
      }
      if (activeFilters.tags.length > 0) {
        if (!activeFilters.tags.some(tag => page.tags.some(t => t.toLowerCase() === tag.toLowerCase()))) {
          return false;
        }
      }
      return true;
    });

    if (sortOptions) {
      result.sort((a, b) => {
        const aVal = a[sortOptions.field] || '';
        const bVal = b[sortOptions.field] || '';
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOptions.direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [pages, debouncedSearchText, activeFilters.tags, sortOptions]);

  // Pre-build lookup maps for O(1) access instead of O(n) find/filter per node
  const { childrenMap, pageMap } = useMemo(() => {
    const cMap = new Map<string, typeof filteredPages>();
    const pMap = new Map<string, typeof filteredPages[number]>();

    for (const page of filteredPages) {
      pMap.set(page.id, page);
    }

    for (const page of filteredPages) {
      if (page.parentId) {
        const siblings = cMap.get(page.parentId);
        if (siblings) {
          siblings.push(page);
        } else {
          cMap.set(page.parentId, [page]);
        }
      }
    }

    return { childrenMap: cMap, pageMap: pMap };
  }, [filteredPages]);

  const rootPages = useMemo(
    () => filteredPages.filter(p => !p.parentId),
    [filteredPages]
  );

  const allTags = useMemo(() =>
    Array.from(
      pages.flatMap(p => p.tags).reduce((map, tag) => {
        const key = tag.toLowerCase();
        if (!map.has(key)) map.set(key, tag);
        return map;
      }, new Map<string, string>()).values()
    ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    [pages]
  );

  const toggleTag = (tag: string) => {
    const currentTags = activeFilters.tags;
    const newTags = currentTags.some(t => t.toLowerCase() === tag.toLowerCase())
      ? currentTags.filter(t => t.toLowerCase() !== tag.toLowerCase())
      : [...currentTags, tag];
    setActiveFilters({ ...activeFilters, tags: newTags });
  };

  // Use stable color assignment based on alphabetically sorted tags
  const getColColor = (col: string) => {
    const customColor = columnColors[col.toLowerCase()];
    if (customColor) return customColor;
    const stableIndex = allTags.findIndex(t => t.toLowerCase() === col.toLowerCase());
    return DEFAULT_PALETTE[stableIndex % DEFAULT_PALETTE.length];
  };

  // Render a single page item (ultra-compact design)
  const renderPageItem = (pageId: string, level: number = 0) => {
    const page = pageMap.get(pageId);
    if (!page) return null;

    const children = childrenMap.get(pageId) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedPages.has(pageId);

    return (
      <div key={page.id} className="page-tree-node" data-level={level}>
        <div className="page-item" style={{ paddingLeft: `${level * 16}px` }}>
          {/* Collapse toggle */}
          {hasChildren ? (
            <button
              className="collapse-btn"
              onClick={() => toggleCollapse(page.id)}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <span className="collapse-icon">{isCollapsed ? '›' : '⌄'}</span>
            </button>
          ) : (
            <span className="collapse-placeholder" />
          )}

          {/* Page link */}
          <Link
            to={`/page/${page.id}`}
            className="page-link"
            replace
          >
            {page.title}
          </Link>

          {/* Add sub-page button */}
          <button
            className="add-child-btn"
            onClick={(e) => handleCreateSubPage(page.id, e)}
            aria-label="Add sub-page"
          >
            <span className="add-icon">+</span>
          </button>
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && (
          <div className="page-children">
            {children.map(child => renderPageItem(child.id, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const visibleRootPages = rootPages.slice(0, visibleCount);
  const remainingCount = rootPages.length - visibleCount;

  return (
    <aside className="sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-header">
        <div className="sidebar-header-actions">
          <button
            className="btn-icon"
            onClick={() => {
              setCreateParentId(undefined);
              setShowCreateModal(true);
            }}
            title="New page"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
          <button
            className="btn-icon"
            onClick={loadPages}
            disabled={loading}
            title="Refresh pages"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="btn-icon"
            title="Close sidebar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search pages..."
          value={searchText}
          onChange={e => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {allTags.length > 0 && (
        <div className="sidebar-tag-section">
          <button
            className="tag-filter-toggle"
            onClick={() => setShowTagFilters(!showTagFilters)}
          >
            <span className="material-symbols-outlined">
              {showTagFilters ? 'expand_less' : 'expand_more'}
            </span>
            <span>Tag Filters</span>
            {activeFilters.tags.length > 0 && (
              <span className="active-count">({activeFilters.tags.length})</span>
            )}
          </button>
          {showTagFilters && (
            <div className="sidebar-tags">
              {allTags.map((tag) => {
                const isActive = activeFilters.tags.includes(tag);
                const color = getColColor(tag);
                return (
                  <button
                    key={tag}
                    className={`filter-tag ${isActive ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                    style={isActive
                      ? { backgroundColor: color, color: 'white', borderColor: 'transparent' }
                      : { borderColor: color, color: color }}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeFilters.tags.length > 0 && (
                <button
                  className="filter-tag clear-tag"
                  onClick={() => setActiveFilters({ ...activeFilters, tags: [] })}
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="sidebar-controls">
        <select
          className="sort-select"
          value={sortOptions?.field || ''}
          onChange={e => {
            const field = e.target.value;
            if (!field) {
              setSortOptions(null);
            } else {
              setSortOptions({
                field: field as 'title' | 'createdAt' | 'updatedAt' | 'dueDate',
                direction: sortOptions?.direction || 'asc',
              });
            }
          }}
        >
          <option value="">Default order</option>
          <option value="title">Title</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="dueDate">Due Date</option>
        </select>
        {sortOptions && (
          <button
            className="sort-dir-btn"
            onClick={() => setSortOptions({
              ...sortOptions,
              direction: sortOptions.direction === 'asc' ? 'desc' : 'asc',
            })}
            title={sortOptions.direction === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOptions.direction === 'asc' ? '↑' : '↓'}
          </button>
        )}
        <div className="sidebar-controls-divider" />
        <span className="sidebar-page-count">
          {rootPages.length === filteredPages.length
            ? `${filteredPages.length}`
            : `${filteredPages.length}`} pages
        </span>
        <div className="sidebar-controls-divider" />
        <button
          className="btn-icon"
          onClick={() => collapsedPages.size > 0 ? expandAll() : collapseAll()}
          title={collapsedPages.size > 0 ? 'Expand all' : 'Collapse all'}
        >
          <span className="material-symbols-outlined">
            {collapsedPages.size > 0 ? 'unfold_more' : 'unfold_less'}
          </span>
        </button>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="loading">
            <span className="loading-text">Loading pages...</span>
          </div>
        ) : visibleRootPages.length > 0 ? (
          <>
            <div className="pages-list">
              {visibleRootPages.map(page => renderPageItem(page.id))}
            </div>
            {remainingCount > 0 && (
              <button
                className="load-more-btn"
                onClick={() => setVisibleCount(prev => prev + PAGE_BATCH_SIZE)}
              >
                <span className="load-more-text">
                  Show {Math.min(remainingCount, PAGE_BATCH_SIZE)} more
                </span>
                <span className="load-more-count">({remainingCount} remaining)</span>
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">📄</span>
            <p className="empty-title">No pages yet</p>
            <p className="empty-subtitle">Click + to create your first page</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreatePageModal
          parentId={createParentId}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Resize handle */}
      <div
        className={`sidebar-resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
        onDoubleClick={() => setSidebarWidth(280)}
        title="Drag to resize, double-click to reset"
      />
    </aside>
  );
}
