/**
 * Global application state using Zustand
 */

import { create } from 'zustand';
import { Page, AppConfig, DEFAULT_CONFIG, SortOptions } from '@/types';
import { AppSlashCommand, DEFAULT_SLASH_COMMANDS } from '@/data/defaultSlashCommands';
import { configService, FontSettings } from '@/services/configService';
import {
  buildNormalizedState,
  addPageToIndexes,
  removePageFromIndexes,
  updatePageInIndexes,
  type PageIndexes,
} from './normalizedHelpers';
import { perfMonitor } from '@/lib/performance';

// Load initial settings from localStorage (synchronous, fast first render)
const initialSettings = configService.loadFromLocalStorage();

/** Collect current settings from state and persist to both localStorage + file */
const persistSettings = (state: {
  columnColors: Record<string, string>;
  slashCommands: AppSlashCommand[];
  theme: 'light' | 'dark' | 'auto';
  columnOrder: string[];
  zoomLevel: number;
  fontSettings: FontSettings;
  boardDensity: 'normal' | 'compact';
  boardView: 'kanban' | 'list' | 'compact';
  sidebarWidth: number;
  highlightColors: string[];
  pageWidth: 'narrow' | 'wide';
  useWYSIWYG: boolean;
}) => {
  configService.save({
    columnColors: state.columnColors,
    slashCommands: state.slashCommands,
    theme: state.theme,
    columnOrder: state.columnOrder,
    zoomLevel: state.zoomLevel,
    fontSettings: state.fontSettings,
    boardDensity: state.boardDensity,
    boardView: state.boardView,
    sidebarWidth: state.sidebarWidth,
    highlightColors: state.highlightColors,
    pageWidth: state.pageWidth,
    useWYSIWYG: state.useWYSIWYG,
  });
};

interface AppState {
  // File system access
  hasFileSystemAccess: boolean;
  setHasFileSystemAccess: (hasAccess: boolean) => void;

  // Current page
  currentPage: Page | null;
  setCurrentPage: (page: Page | null) => void;

  // All pages cache (NORMALIZED)
  pages: Record<string, Page>;  // Normalized entity map
  pageIds: string[];  // Array of page IDs
  indexes: PageIndexes;  // Indexes for fast lookups

  // MIGRATION: Backward compatibility - use this instead of pages during migration
  pagesArray: Page[];  // Computed on every state change
  getPagesArray: () => Page[];

  setPages: (pages: Page[]) => void;
  addPage: (page: Page) => void;
  updatePageInStore: (page: Page) => void;
  removePage: (pageId: string) => void;

  // App configuration
  config: AppConfig;
  setConfig: (config: AppConfig) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Filter state
  activeFilters: {
    tags: string[];
    searchText: string;
  };
  setActiveFilters: (filters: { tags: string[]; searchText: string }) => void;

  // Sort state
  sortOptions: SortOptions | null;
  setSortOptions: (sort: SortOptions | null) => void;

  // Theme (persisted)
  theme: 'light' | 'dark' | 'auto';
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;

  // Column colors
  columnColors: Record<string, string>;
  setColumnColor: (column: string, color: string) => void;
  removeColumnColor: (column: string) => void;

  // Slash commands
  slashCommands: AppSlashCommand[];
  addSlashCommand: (cmd: AppSlashCommand) => void;
  updateSlashCommand: (cmd: AppSlashCommand) => void;
  removeSlashCommand: (id: string) => void;
  resetSlashCommands: () => void;

  // Column order (persisted)
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;

  // Zoom level (persisted)
  zoomLevel: number;
  setZoomLevel: (level: number) => void;

  // Font settings (persisted)
  fontSettings: FontSettings;
  setFontSettings: (fontSettings: FontSettings) => void;

  // Board density (persisted)
  boardDensity: 'normal' | 'compact';
  setBoardDensity: (density: 'normal' | 'compact') => void;

  // Board view (persisted)
  boardView: 'kanban' | 'list' | 'compact';
  setBoardView: (view: 'kanban' | 'list' | 'compact') => void;

  // Sidebar width (persisted)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  // Highlight colors (persisted)
  highlightColors: string[];
  setHighlightColors: (colors: string[]) => void;

  // Page width (persisted)
  pageWidth: 'narrow' | 'wide';
  setPageWidth: (width: 'narrow' | 'wide') => void;

  // WYSIWYG editor (persisted)
  useWYSIWYG: boolean;
  setUseWYSIWYG: (useWYSIWYG: boolean) => void;

  // Toast notification (not persisted)
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  // Immerse mode (not persisted)
  isImmerseMode: boolean;
  setIsImmerseMode: (isImmerse: boolean) => void;

  // Settings persistence
  loadSettingsFromFile: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // File system access
  hasFileSystemAccess: false,
  setHasFileSystemAccess: (hasAccess) => set({ hasFileSystemAccess: hasAccess }),

  // Current page
  currentPage: null,
  setCurrentPage: (page) => set({ currentPage: page }),

  // All pages cache (NORMALIZED)
  pages: {},
  pageIds: [],
  indexes: {
    columnIndex: {},
    tagIndex: {},
    parentIndex: {},
  },

  // Backward compatibility: Convert normalized state to array
  getPagesArray: () => {
    const state = get();
    return state.pageIds.map(id => state.pages[id]).filter(Boolean);
  },

  pagesArray: [],

  setPages: (inputPages) => {
    perfMonitor.start('store.setPages');
    const normalized = buildNormalizedState(inputPages);
    const pagesArray = normalized.pageIds.map(id => normalized.pages[id]);
    set({
      pages: normalized.pages,
      pageIds: normalized.pageIds,
      indexes: normalized.indexes,
      pagesArray,
    });
    perfMonitor.end('store.setPages', 'state', { pageCount: inputPages.length });
  },

  addPage: (page) =>
    set((state) => {
      perfMonitor.start('store.addPage');
      const newPages = { ...state.pages, [page.id]: page };
      const newPageIds = [...state.pageIds, page.id];
      const newIndexes = {
        columnIndex: { ...state.indexes.columnIndex },
        tagIndex: { ...state.indexes.tagIndex },
        parentIndex: { ...state.indexes.parentIndex },
      };
      addPageToIndexes(newIndexes, page);

      const pagesArray = newPageIds.map(id => newPages[id]);

      perfMonitor.end('store.addPage', 'state', { pageId: page.id });
      return {
        pages: newPages,
        pageIds: newPageIds,
        indexes: newIndexes,
        pagesArray,
      };
    }),

  updatePageInStore: (page) =>
    set((state) => {
      perfMonitor.start('store.updatePage');
      const oldPage = state.pages[page.id];
      const newPages = { ...state.pages, [page.id]: page };
      const newIndexes = {
        columnIndex: { ...state.indexes.columnIndex },
        tagIndex: { ...state.indexes.tagIndex },
        parentIndex: { ...state.indexes.parentIndex },
      };

      if (oldPage) {
        updatePageInIndexes(newIndexes, oldPage, page);
      } else {
        addPageToIndexes(newIndexes, page);
      }

      perfMonitor.end('store.updatePage', 'state', { pageId: page.id });

      const pagesArray = state.pageIds.map(id => newPages[id]);

      return {
        pages: newPages,
        indexes: newIndexes,
        pagesArray,
        currentPage: state.currentPage?.id === page.id ? page : state.currentPage,
      };
    }),

  removePage: (pageId) =>
    set((state) => {
      const pageToRemove = state.pages[pageId];
      const { [pageId]: removed, ...remainingPages } = state.pages;
      const newPageIds = state.pageIds.filter(id => id !== pageId);
      const newIndexes = {
        columnIndex: { ...state.indexes.columnIndex },
        tagIndex: { ...state.indexes.tagIndex },
        parentIndex: { ...state.indexes.parentIndex },
      };

      if (pageToRemove) {
        removePageFromIndexes(newIndexes, pageToRemove);
      }

      const pagesArray = newPageIds.map(id => remainingPages[id]);

      return {
        pages: remainingPages,
        pageIds: newPageIds,
        indexes: newIndexes,
        pagesArray,
        currentPage: state.currentPage?.id === pageId ? null : state.currentPage,
      };
    }),

  // App configuration
  config: DEFAULT_CONFIG,
  setConfig: (config) => set({ config }),

  // UI state
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Filter state
  activeFilters: {
    tags: [],
    searchText: ''
  },
  setActiveFilters: (filters) => set({ activeFilters: filters }),

  // Sort state
  sortOptions: null,
  setSortOptions: (sort) => set({ sortOptions: sort }),

  // Theme
  theme: initialSettings.theme,
  setTheme: (theme) => {
    set({ theme });
    const state = get();
    persistSettings({ ...state, theme });
  },

  // Column colors
  columnColors: initialSettings.columnColors,
  setColumnColor: (column, color) =>
    set((state) => {
      const updated = { ...state.columnColors, [column.toLowerCase()]: color };
      persistSettings({ ...state, columnColors: updated });
      return { columnColors: updated };
    }),
  removeColumnColor: (column) =>
    set((state) => {
      const updated = { ...state.columnColors };
      delete updated[column.toLowerCase()];
      persistSettings({ ...state, columnColors: updated });
      return { columnColors: updated };
    }),

  // Slash commands
  slashCommands: initialSettings.slashCommands,
  addSlashCommand: (cmd) =>
    set((state) => {
      const updated = [...state.slashCommands, cmd];
      persistSettings({ ...state, slashCommands: updated });
      return { slashCommands: updated };
    }),
  updateSlashCommand: (cmd) =>
    set((state) => {
      const updated = state.slashCommands.map((c) => (c.id === cmd.id ? cmd : c));
      persistSettings({ ...state, slashCommands: updated });
      return { slashCommands: updated };
    }),
  removeSlashCommand: (id) =>
    set((state) => {
      const updated = state.slashCommands.filter((c) => c.id !== id);
      persistSettings({ ...state, slashCommands: updated });
      return { slashCommands: updated };
    }),
  resetSlashCommands: () =>
    set((state) => {
      persistSettings({ ...state, slashCommands: DEFAULT_SLASH_COMMANDS });
      return { slashCommands: DEFAULT_SLASH_COMMANDS };
    }),

  // Column order
  columnOrder: initialSettings.columnOrder,
  setColumnOrder: (order) => {
    set((state) => {
      persistSettings({ ...state, columnOrder: order });
      return { columnOrder: order };
    });
  },

  // Zoom level
  zoomLevel: initialSettings.zoomLevel,
  setZoomLevel: (level) => {
    set({ zoomLevel: level });
    const state = get();
    persistSettings({ ...state, zoomLevel: level });
  },

  // Font settings
  fontSettings: initialSettings.fontSettings,
  setFontSettings: (fontSettings) => {
    set({ fontSettings });
    const state = get();
    persistSettings({ ...state, fontSettings });
  },

  // Board density
  boardDensity: initialSettings.boardDensity,
  setBoardDensity: (density) => {
    set({ boardDensity: density });
    const state = get();
    persistSettings({ ...state, boardDensity: density });
  },

  // Board view
  boardView: initialSettings.boardView || 'kanban',
  setBoardView: (view) => {
    set({ boardView: view });
    const state = get();
    persistSettings({ ...state, boardView: view });
  },

  // Sidebar width
  sidebarWidth: initialSettings.sidebarWidth || 280,
  setSidebarWidth: (width) => {
    set({ sidebarWidth: width });
    const state = get();
    persistSettings({ ...state, sidebarWidth: width });
  },

  // Highlight colors
  highlightColors: initialSettings.highlightColors || ['#FFEB3B', '#C5E1A5', '#90CAF9', '#FFCC80', '#F48FB1'],
  setHighlightColors: (colors) => {
    set({ highlightColors: colors });
    const state = get();
    persistSettings({ ...state, highlightColors: colors });
  },

  // Page width
  pageWidth: initialSettings.pageWidth || 'narrow',
  setPageWidth: (width) => {
    set({ pageWidth: width });
    const state = get();
    persistSettings({ ...state, pageWidth: width });
  },

  // WYSIWYG editor
  useWYSIWYG: initialSettings.useWYSIWYG ?? false,
  setUseWYSIWYG: (useWYSIWYG) => {
    set({ useWYSIWYG });
    const state = get();
    persistSettings({ ...state, useWYSIWYG });
  },

  // Toast notification
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      set({ toast: null });
    }, 3000);
  },
  hideToast: () => set({ toast: null }),

  // Immerse mode
  isImmerseMode: false,
  setIsImmerseMode: (isImmerse) => set({ isImmerseMode: isImmerse }),

  // Load settings from .kanban-config.json (called when FS access is granted)
  loadSettingsFromFile: async () => {
    const fileSettings = await configService.loadFromFile();
    if (fileSettings) {
      // File exists → use file as source of truth
      set({
        columnColors: fileSettings.columnColors,
        slashCommands: fileSettings.slashCommands,
        theme: fileSettings.theme,
        columnOrder: fileSettings.columnOrder,
        zoomLevel: fileSettings.zoomLevel,
        fontSettings: fileSettings.fontSettings,
        boardDensity: fileSettings.boardDensity,
        boardView: fileSettings.boardView || 'kanban',
        sidebarWidth: fileSettings.sidebarWidth || 280,
        highlightColors: fileSettings.highlightColors || ['#FFEB3B', '#C5E1A5', '#90CAF9', '#FFCC80', '#F48FB1'],
        pageWidth: fileSettings.pageWidth || 'narrow',
        useWYSIWYG: fileSettings.useWYSIWYG ?? false,
      });
      // Sync localStorage cache
      configService.saveToLocalStorage(fileSettings);
    } else {
      // File doesn't exist → migrate current state (from localStorage) to file
      const state = get();
      await configService.saveToFile({
        columnColors: state.columnColors,
        slashCommands: state.slashCommands,
        theme: state.theme,
        columnOrder: state.columnOrder,
        zoomLevel: state.zoomLevel,
        fontSettings: state.fontSettings,
        boardDensity: state.boardDensity,
        boardView: state.boardView,
        sidebarWidth: state.sidebarWidth,
        highlightColors: state.highlightColors,
        pageWidth: state.pageWidth,
        useWYSIWYG: state.useWYSIWYG,
      });
    }
  },
}));
