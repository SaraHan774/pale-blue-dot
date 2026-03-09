import { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { useStore } from '@/store/useStore';
import { fileSystemService } from '@/services';
import './Layout.css';

// Augment CSSStyleDeclaration with the non-standard `zoom` property
declare global {
  interface CSSStyleDeclaration {
    zoom: string;
  }
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

export function Layout() {
  const { sidebarOpen, setSidebarOpen, hasFileSystemAccess, setHasFileSystemAccess, theme, setTheme, zoomLevel, setZoomLevel, fontSettings, sidebarWidth, isImmerseMode } = useStore();
  const [zoomToast, setZoomToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, attempt to restore file system access from IndexedDB
  useEffect(() => {
    if (hasFileSystemAccess) return;

    const restore = async () => {
      const result = await fileSystemService.tryRestore();
      if (result === 'granted') {
        setHasFileSystemAccess(true);
      }
      // 'prompt' case is handled by Home.tsx reconnect UI
    };
    restore();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Apply font settings as CSS custom properties on :root
  useEffect(() => {
    const root = document.documentElement;
    const sansFallbacks = "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    const monoFallbacks = "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace";

    // Content fonts (for reading - page view)
    if (fontSettings.contentFontFamily === 'System Default') {
      root.style.setProperty('--font-content', sansFallbacks);
    } else {
      root.style.setProperty('--font-content', `'${fontSettings.contentFontFamily}', ${sansFallbacks}`);
    }
    root.style.setProperty('--font-content-size', `${fontSettings.contentFontSize}px`);
    root.style.setProperty('--line-height-content', `${fontSettings.contentLineHeight}`);

    // UI fonts (for controls, sidebar, etc.)
    if (fontSettings.uiFontFamily === 'System Default') {
      root.style.setProperty('--font-ui', sansFallbacks);
    } else {
      root.style.setProperty('--font-ui', `'${fontSettings.uiFontFamily}', ${sansFallbacks}`);
    }
    root.style.setProperty('--font-ui-size', `${fontSettings.uiFontSize}px`);

    // Monospace font (shared)
    root.style.setProperty('--font-mono', `'${fontSettings.monoFontFamily}', ${monoFallbacks}`);

    // Legacy variables for backward compatibility (use UI font as default)
    root.style.setProperty('--font-sans', fontSettings.uiFontFamily === 'System Default'
      ? sansFallbacks
      : `'${fontSettings.uiFontFamily}', ${sansFallbacks}`);
    root.style.setProperty('--font-size-base', `${fontSettings.uiFontSize}px`);

    // Apply heading colors
    root.style.setProperty('--heading-h1-color', fontSettings.headingColors.h1);
    root.style.setProperty('--heading-h2-color', fontSettings.headingColors.h2);
    root.style.setProperty('--heading-h3-color', fontSettings.headingColors.h3);
    root.style.setProperty('--heading-h4-color', fontSettings.headingColors.h4);
  }, [fontSettings]);

  // Apply zoom CSS on the root element
  useEffect(() => {
    document.documentElement.style.zoom = `${zoomLevel}%`;
  }, [zoomLevel]);

  // Show toast with current zoom level, auto-hide after 1.5s
  const showZoomToast = useCallback((level: number) => {
    setZoomToast(`${level}%`);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setZoomToast(null);
      toastTimerRef.current = null;
    }, 1500);
  }, []);

  // Keyboard shortcut listener for zoom: Cmd+Plus, Cmd+Minus, Cmd+0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      // Cmd+= or Cmd+Shift+= (zoom in)
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const next = Math.min(zoomLevel + ZOOM_STEP, ZOOM_MAX);
        if (next !== zoomLevel) {
          setZoomLevel(next);
          showZoomToast(next);
        }
        return;
      }

      // Cmd+- (zoom out)
      if (e.key === '-') {
        e.preventDefault();
        const next = Math.max(zoomLevel - ZOOM_STEP, ZOOM_MIN);
        if (next !== zoomLevel) {
          setZoomLevel(next);
          showZoomToast(next);
        }
        return;
      }

      // Cmd+0 (reset to 100%)
      if (e.key === '0') {
        e.preventDefault();
        if (zoomLevel !== 100) {
          setZoomLevel(100);
        }
        showZoomToast(100);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomLevel, setZoomLevel, showZoomToast]);

  const cycleTheme = () => {
    const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    setTheme(next);
  };

  const themeLabel = theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  return (
    <div className="layout">
      {!isImmerseMode && (
      <div
        className={`sidebar-container ${sidebarOpen ? 'open' : 'closed'}`}
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0' }}
      >
        <Sidebar />
      </div>
      )}
      <main className="main-content">
        {!isImmerseMode && (
        <div className="top-bar">
          {!sidebarOpen && (
            <button className="btn-icon" onClick={() => setSidebarOpen(true)} title="Open sidebar">
              ☰
            </button>
          )}
          <Link to="/" className="home-button">
            <span className="material-symbols-outlined">home</span>
            HOME
          </Link>
          <div className="top-bar-spacer" />
          <Link to="/settings" className="settings-button" title="Settings">
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${themeLabel}`}>
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'brightness_auto'}
            </span>
            <span className="theme-label">{themeLabel}</span>
          </button>
        </div>
        )}
        <Outlet />
      </main>
      {zoomToast && (
        <div className="zoom-toast">{zoomToast}</div>
      )}

      {/* Global toast notifications */}
      <Toast />
    </div>
  );
}
