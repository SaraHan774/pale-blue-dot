/**
 * Config Service
 * Persists app settings to .kanban-config.json in the workspace root.
 * Falls back to localStorage when file system is unavailable.
 */

import { fileSystemService } from './fileSystemFactory';
import { AppSlashCommand, DEFAULT_SLASH_COMMANDS } from '@/data/defaultSlashCommands';

const CONFIG_FILE = '.kanban-config.json';

// localStorage keys (used as cache / fallback)
const LS_COLUMN_COLORS = 'kanban-column-colors';
const LS_SLASH_COMMANDS = 'kanban-slash-commands';
const LS_THEME = 'kanban-theme';
const LS_COLUMN_ORDER = 'kanban-column-order';
const LS_ZOOM_LEVEL = 'kanban-zoom-level';
const LS_FONT_SETTINGS = 'kanban-font-settings';
const LS_BOARD_DENSITY = 'kanban-board-density';
const LS_BOARD_VIEW = 'kanban-board-view';
const LS_SIDEBAR_WIDTH = 'kanban-sidebar-width';
const LS_HIGHLIGHT_COLORS = 'kanban-highlight-colors';
const LS_PAGE_WIDTH = 'kanban-page-width';
const LS_USE_WYSIWYG = 'kanban-use-wysiwyg';

export interface FontSettings {
  // Content fonts (page view - reading area)
  contentFontFamily: string;
  contentFontSize: number;
  contentLineHeight: number;

  // UI fonts (controls, sidebar, buttons, etc.)
  uiFontFamily: string;
  uiFontSize: number;

  // Shared settings
  monoFontFamily: string;
  headingColors: {
    h1: string;
    h2: string;
    h3: string;
    h4: string;
  };
}

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  contentFontFamily: 'Pretendard',
  contentFontSize: 16,
  contentLineHeight: 1.7,
  uiFontFamily: 'Pretendard',
  uiFontSize: 14,
  monoFontFamily: 'Fira Code',
  headingColors: {
    h1: 'inherit', // Use default text color
    h2: 'inherit',
    h3: 'inherit',
    h4: 'inherit',
  },
};

export interface KanbanSettings {
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
  useWYSIWYG: boolean; // Feature flag for Tiptap WYSIWYG editor (Phase 0-8 migration)
}

const DEFAULT_SETTINGS: KanbanSettings = {
  columnColors: {},
  slashCommands: DEFAULT_SLASH_COMMANDS,
  theme: 'auto',
  columnOrder: [],
  zoomLevel: 100,
  fontSettings: DEFAULT_FONT_SETTINGS,
  boardDensity: 'normal',
  boardView: 'kanban',
  sidebarWidth: 280,
  highlightColors: ['#FFEB3B', '#C5E1A5', '#90CAF9', '#FFCC80', '#F48FB1'],
  pageWidth: 'narrow',
  useWYSIWYG: false, // Default to old editor (safe rollout)
};

class ConfigService {
  /**
   * Load settings from .kanban-config.json.
   * Returns null if file doesn't exist or FS is unavailable.
   */
  async loadFromFile(): Promise<KanbanSettings | null> {
    try {
      if (!fileSystemService.getRootHandle()) return null;
      const raw = await fileSystemService.readFile(CONFIG_FILE);
      const parsed = JSON.parse(raw);

      // Migrate old font settings to new structure
      let fontSettings = DEFAULT_FONT_SETTINGS;
      if (parsed.fontSettings) {
        const old = parsed.fontSettings;
        fontSettings = {
          ...DEFAULT_FONT_SETTINGS,
          ...parsed.fontSettings,
          // Migrate old fields to new structure
          contentFontFamily: old.contentFontFamily ?? old.fontFamily ?? DEFAULT_FONT_SETTINGS.contentFontFamily,
          contentFontSize: old.contentFontSize ?? old.fontSize ?? DEFAULT_FONT_SETTINGS.contentFontSize,
          contentLineHeight: old.contentLineHeight ?? old.lineHeight ?? DEFAULT_FONT_SETTINGS.contentLineHeight,
          uiFontFamily: old.uiFontFamily ?? old.fontFamily ?? DEFAULT_FONT_SETTINGS.uiFontFamily,
          uiFontSize: old.uiFontSize ?? (old.fontSize ? old.fontSize - 2 : DEFAULT_FONT_SETTINGS.uiFontSize),
        };
      }

      return {
        columnColors: parsed.columnColors ?? DEFAULT_SETTINGS.columnColors,
        slashCommands: parsed.slashCommands ?? DEFAULT_SETTINGS.slashCommands,
        theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
        columnOrder: parsed.columnOrder ?? DEFAULT_SETTINGS.columnOrder,
        zoomLevel: parsed.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel,
        fontSettings,
        boardDensity: parsed.boardDensity ?? DEFAULT_SETTINGS.boardDensity,
        boardView: parsed.boardView ?? DEFAULT_SETTINGS.boardView,
        sidebarWidth: parsed.sidebarWidth ?? DEFAULT_SETTINGS.sidebarWidth,
        highlightColors: parsed.highlightColors ?? DEFAULT_SETTINGS.highlightColors,
        pageWidth: parsed.pageWidth ?? DEFAULT_SETTINGS.pageWidth,
        useWYSIWYG: parsed.useWYSIWYG ?? DEFAULT_SETTINGS.useWYSIWYG,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save settings to .kanban-config.json.
   * Silently fails if FS is unavailable.
   */
  async saveToFile(settings: KanbanSettings): Promise<void> {
    try {
      if (!fileSystemService.getRootHandle()) return;
      const json = JSON.stringify(settings, null, 2);
      await fileSystemService.writeFile(CONFIG_FILE, json);
    } catch (err) {
      console.warn('Failed to save config to file:', err);
    }
  }

  /**
   * Load settings from localStorage (synchronous, used for initial render).
   */
  loadFromLocalStorage(): KanbanSettings {
    const settings = { ...DEFAULT_SETTINGS };

    try {
      const colors = localStorage.getItem(LS_COLUMN_COLORS);
      if (colors) settings.columnColors = JSON.parse(colors);
    } catch { /* ignore */ }

    try {
      const cmds = localStorage.getItem(LS_SLASH_COMMANDS);
      if (cmds) settings.slashCommands = JSON.parse(cmds);
    } catch { /* ignore */ }

    const theme = localStorage.getItem(LS_THEME) as KanbanSettings['theme'] | null;
    if (theme) settings.theme = theme;

    try {
      const order = localStorage.getItem(LS_COLUMN_ORDER);
      if (order) settings.columnOrder = JSON.parse(order);
    } catch { /* ignore */ }

    try {
      const zoom = localStorage.getItem(LS_ZOOM_LEVEL);
      if (zoom) settings.zoomLevel = JSON.parse(zoom);
    } catch { /* ignore */ }

    try {
      const fonts = localStorage.getItem(LS_FONT_SETTINGS);
      if (fonts) {
        const old = JSON.parse(fonts);
        settings.fontSettings = {
          ...DEFAULT_FONT_SETTINGS,
          ...old,
          // Migrate old fields to new structure
          contentFontFamily: old.contentFontFamily ?? old.fontFamily ?? DEFAULT_FONT_SETTINGS.contentFontFamily,
          contentFontSize: old.contentFontSize ?? old.fontSize ?? DEFAULT_FONT_SETTINGS.contentFontSize,
          contentLineHeight: old.contentLineHeight ?? old.lineHeight ?? DEFAULT_FONT_SETTINGS.contentLineHeight,
          uiFontFamily: old.uiFontFamily ?? old.fontFamily ?? DEFAULT_FONT_SETTINGS.uiFontFamily,
          uiFontSize: old.uiFontSize ?? (old.fontSize ? old.fontSize - 2 : DEFAULT_FONT_SETTINGS.uiFontSize),
        };
      }
    } catch { /* ignore */ }

    const boardDensity = localStorage.getItem(LS_BOARD_DENSITY) as KanbanSettings['boardDensity'] | null;
    if (boardDensity) settings.boardDensity = boardDensity;

    const boardView = localStorage.getItem(LS_BOARD_VIEW) as KanbanSettings['boardView'] | null;
    if (boardView) settings.boardView = boardView;

    try {
      const sidebarWidth = localStorage.getItem(LS_SIDEBAR_WIDTH);
      if (sidebarWidth) settings.sidebarWidth = JSON.parse(sidebarWidth);
    } catch { /* ignore */ }

    try {
      const highlightColors = localStorage.getItem(LS_HIGHLIGHT_COLORS);
      if (highlightColors) settings.highlightColors = JSON.parse(highlightColors);
    } catch { /* ignore */ }

    const pageWidth = localStorage.getItem(LS_PAGE_WIDTH) as KanbanSettings['pageWidth'] | null;
    if (pageWidth) settings.pageWidth = pageWidth;

    try {
      const useWYSIWYG = localStorage.getItem(LS_USE_WYSIWYG);
      if (useWYSIWYG) settings.useWYSIWYG = JSON.parse(useWYSIWYG);
    } catch { /* ignore */ }

    return settings;
  }

  /**
   * Save settings to localStorage (synchronous cache).
   */
  saveToLocalStorage(settings: KanbanSettings): void {
    localStorage.setItem(LS_COLUMN_COLORS, JSON.stringify(settings.columnColors));
    localStorage.setItem(LS_SLASH_COMMANDS, JSON.stringify(settings.slashCommands));
    localStorage.setItem(LS_THEME, settings.theme);
    localStorage.setItem(LS_COLUMN_ORDER, JSON.stringify(settings.columnOrder));
    localStorage.setItem(LS_ZOOM_LEVEL, JSON.stringify(settings.zoomLevel));
    localStorage.setItem(LS_FONT_SETTINGS, JSON.stringify(settings.fontSettings));
    localStorage.setItem(LS_BOARD_DENSITY, settings.boardDensity);
    localStorage.setItem(LS_BOARD_VIEW, settings.boardView);
    localStorage.setItem(LS_SIDEBAR_WIDTH, JSON.stringify(settings.sidebarWidth));
    localStorage.setItem(LS_HIGHLIGHT_COLORS, JSON.stringify(settings.highlightColors));
    localStorage.setItem(LS_PAGE_WIDTH, settings.pageWidth);
    localStorage.setItem(LS_USE_WYSIWYG, JSON.stringify(settings.useWYSIWYG));
  }

  /**
   * Save to both localStorage (sync) and file (async).
   */
  save(settings: KanbanSettings): void {
    this.saveToLocalStorage(settings);
    this.saveToFile(settings);
  }
}

export const configService = new ConfigService();
