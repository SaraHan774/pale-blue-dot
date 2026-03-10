import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { DEFAULT_FONT_SETTINGS, FontSettings } from '@/services/configService';
import { AppSlashCommand } from '@/data/defaultSlashCommands';
import { migrationService } from '@/services';
import { fileSystemService } from '@/services/fileSystemFactory';
import './Settings.css';

const SANS_FONT_OPTIONS = [
  { value: 'System Default', label: 'System Default' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Pretendard', label: 'Pretendard' },
  { value: 'Noto Sans', label: 'Noto Sans' },
  { value: 'Noto Sans KR', label: 'Noto Sans KR' },
  { value: 'Noto Serif KR', label: 'Noto Serif KR' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
  { value: 'IBM Plex Sans KR', label: 'IBM Plex Sans KR' },
  { value: 'Nanum Gothic', label: '나눔고딕 (Nanum Gothic)' },
  { value: 'Nanum Myeongjo', label: '나눔명조 (Nanum Myeongjo)' },
  { value: 'Gmarket Sans', label: 'Gmarket Sans' },
  { value: 'Spoqa Han Sans Neo', label: 'Spoqa Han Sans Neo' },
  { value: 'Do Hyeon', label: '도현 (Do Hyeon)' },
];

const MONO_FONT_OPTIONS = [
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'Cascadia Code', label: 'Cascadia Code' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
  { value: 'Inconsolata', label: 'Inconsolata' },
  { value: 'D2Coding', label: 'D2Coding' },
  { value: 'Menlo', label: 'Menlo' },
  { value: 'Monaco', label: 'Monaco' },
];

const DEFAULT_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function Settings() {
  const {
    slashCommands, addSlashCommand, updateSlashCommand, removeSlashCommand, resetSlashCommands,
    pagesArray, columnColors, setColumnColor, removeColumnColor,
    fontSettings, setFontSettings,
    boardDensity, setBoardDensity,
    highlightColors, setHighlightColors,
    pageWidth, setPageWidth,
    useWYSIWYG, setUseWYSIWYG,
    config, setConfig, showToast,
  } = useStore();
  const pages = pagesArray;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formInsert, setFormInsert] = useState('');
  const [formCursorOffset, setFormCursorOffset] = useState('');
  const [formError, setFormError] = useState('');

  // Migration state
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  // Check if migration is needed on mount
  useEffect(() => {
    const checkMigration = async () => {
      const needs = await migrationService.needsMigration();
      setNeedsMigration(needs);
    };
    checkMigration();
  }, []);

  // TOC
  const tocItems = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'typography', label: 'Typography' },
    { id: 'board-appearance', label: 'Board Appearance' },
    { id: 'highlight-colors', label: 'Highlight Colors' },
    { id: 'column-colors', label: 'Column Colors' },
    ...(needsMigration ? [{ id: 'migration', label: 'Migration' }] : []),
    { id: 'slash-commands', label: 'Slash Commands' },
    { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts' },
  ];

  const [activeSection, setActiveSection] = useState(tocItems[0]?.id ?? '');

  // Track active section on scroll in the content container
  useEffect(() => {
    const scrollContainer = document.querySelector('.settings-content') as HTMLElement | null;
    if (!scrollContainer) return;

    const sectionIds = tocItems.map((t) => t.id);

    const handleScroll = () => {
      const threshold = scrollContainer.getBoundingClientRect().top + 120;
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= threshold) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMigration]);

  const handleChangeWorkspace = async () => {
    try {
      const handle = await fileSystemService.requestDirectoryAccess();
      const newPath = handle.name;

      setConfig({
        ...config,
        workspacePath: newPath,
      });

      showToast(`Workspace changed to: ${newPath}. Please refresh the page.`, 'success');

      // Refresh after a short delay to allow user to see the toast
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to change workspace:', error);
      showToast('Failed to change workspace. Please try again.', 'error');
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm(
      'This will convert your workspace from folder-based to file-based structure.\n\n' +
      'Before proceeding:\n' +
      '1. Make sure you have a backup of your workspace\n' +
      '2. Close all open pages\n' +
      '3. This action cannot be undone\n\n' +
      'Continue with migration?'
    )) {
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const result = await migrationService.migrate();

      if (result.success) {
        setMigrationResult(
          `✅ Migration successful!\n\n` +
          `Migrated ${result.migratedPages} pages\n` +
          `Moved ${result.migratedImages} images to centralized storage\n\n` +
          `Please refresh the page to see the changes.`
        );
        setNeedsMigration(false);
      } else {
        setMigrationResult(
          `⚠️ Migration completed with errors:\n\n` +
          `Migrated: ${result.migratedPages} pages, ${result.migratedImages} images\n\n` +
          `Errors:\n${result.errors.join('\n')}`
        );
      }
    } catch (error) {
      setMigrationResult(`❌ Migration failed: ${error}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const startEdit = (cmd: AppSlashCommand) => {
    setEditingId(cmd.id);
    setIsAdding(false);
    setFormKey(cmd.key);
    setFormLabel(cmd.label);
    setFormIcon(cmd.icon);
    setFormInsert(cmd.insert);
    setFormCursorOffset(cmd.cursorOffset?.toString() || '');
    setFormError('');
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormKey('');
    setFormLabel('');
    setFormIcon('');
    setFormInsert('');
    setFormCursorOffset('');
    setFormError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormError('');
  };

  const validateAndSave = () => {
    const key = formKey.toLowerCase().trim();

    if (!key || !formLabel.trim() || !formIcon.trim() || !formInsert) {
      setFormError('Key, Label, Icon, and Insert text are all required.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(key)) {
      setFormError('Key must contain only lowercase letters, numbers, and hyphens.');
      return;
    }

    // Check duplicate key (exclude current editing item)
    const duplicate = slashCommands.find((c) => c.key === key && c.id !== editingId);
    if (duplicate) {
      setFormError(`Key "/${key}" is already used by "${duplicate.label}".`);
      return;
    }

    const cursorOffset = formCursorOffset ? parseInt(formCursorOffset, 10) : undefined;
    if (formCursorOffset && (isNaN(cursorOffset!) || cursorOffset! < 0)) {
      setFormError('Cursor offset must be a non-negative number.');
      return;
    }

    if (editingId) {
      const existing = slashCommands.find((c) => c.id === editingId);
      updateSlashCommand({
        id: editingId,
        key,
        label: formLabel.trim(),
        icon: formIcon.trim(),
        insert: formInsert,
        cursorOffset,
        builtin: existing?.builtin,
      });
    } else {
      addSlashCommand({
        id: `custom-${Date.now()}`,
        key,
        label: formLabel.trim(),
        icon: formIcon.trim(),
        insert: formInsert,
        cursorOffset,
      });
    }

    cancelEdit();
  };

  const handleDelete = (cmd: AppSlashCommand) => {
    if (!window.confirm(`Delete command "/${cmd.key}"?`)) return;
    removeSlashCommand(cmd.id);
    if (editingId === cmd.id) cancelEdit();
  };

  const handleReset = () => {
    if (!window.confirm('Reset all commands to defaults? Custom commands will be removed.')) return;
    resetSlashCommands();
    cancelEdit();
  };

  const renderForm = () => (
    <div className="settings-form">
      <div className="settings-form-row">
        <div className="settings-form-field">
          <label>Key</label>
          <div className="settings-key-input">
            <span className="settings-key-prefix">/</span>
            <input
              type="text"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="command-key"
            />
          </div>
        </div>
        <div className="settings-form-field">
          <label>Label</label>
          <input
            type="text"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            placeholder="Display name"
          />
        </div>
        <div className="settings-form-field settings-form-field-sm">
          <label>Icon</label>
          <input
            type="text"
            value={formIcon}
            onChange={(e) => setFormIcon(e.target.value)}
            placeholder="emoji"
          />
        </div>
      </div>
      <div className="settings-form-field">
        <label>Insert Text</label>
        <textarea
          value={formInsert}
          onChange={(e) => setFormInsert(e.target.value)}
          placeholder="Text to insert when command is executed..."
          rows={3}
        />
        {formInsert && (
          <div className="settings-preview">
            <span className="settings-preview-label">Preview:</span>
            <pre>{formInsert}</pre>
          </div>
        )}
      </div>
      <div className="settings-form-field settings-form-field-sm">
        <label>Cursor Offset (from end)</label>
        <input
          type="number"
          value={formCursorOffset}
          onChange={(e) => setFormCursorOffset(e.target.value)}
          placeholder="0"
          min="0"
        />
      </div>
      {formError && <div className="settings-error">{formError}</div>}
      <div className="settings-form-actions">
        <button className="btn btn-primary" onClick={validateAndSave}>
          {editingId ? 'Update' : 'Add'}
        </button>
        <button className="btn btn-secondary" onClick={cancelEdit}>
          Cancel
        </button>
      </div>
    </div>
  );

  // Derive existing columns from all pages
  const existingColumns = Array.from(
    pages.map(p => p.kanbanColumn).filter(Boolean).reduce((map, col) => {
      const key = (col as string).toLowerCase();
      if (!map.has(key)) map.set(key, col as string);
      return map;
    }, new Map<string, string>()).values()
  );

  // Sort columns alphabetically for stable color assignment
  const sortedColumnNames = [...existingColumns].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const getColumnColor = (col: string) => {
    const customColor = columnColors[col.toLowerCase()];
    if (customColor) return customColor;
    const stableIndex = sortedColumnNames.findIndex(c => c.toLowerCase() === col.toLowerCase());
    return DEFAULT_PALETTE[stableIndex % DEFAULT_PALETTE.length];
  };

  const updateFont = (patch: Partial<FontSettings>) => {
    setFontSettings({ ...fontSettings, ...patch });
  };

  const resetFontSettings = () => {
    setFontSettings(DEFAULT_FONT_SETTINGS);
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <div className="settings-layout">
        <nav className="settings-toc">
          {tocItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                const contentContainer = document.querySelector('.settings-content') as HTMLElement | null;
                const targetSection = document.getElementById(item.id);
                if (!contentContainer || !targetSection) return;

                // Scroll the content container to the target section
                const offsetTop = targetSection.offsetTop;
                contentContainer.scrollTo({
                  top: offsetTop - 20, // Small offset from top
                  behavior: 'smooth'
                });
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="settings-content">
      {/* Workspace Section */}
      <section id="workspace" className="settings-section">
        <div className="settings-section-header">
          <h2>Workspace</h2>
        </div>

        <div className="settings-group">
          <label>Current Workspace Directory</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{
              flex: 1,
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}>
              {config.workspacePath}
            </div>
            <button
              className="btn btn-primary"
              onClick={handleChangeWorkspace}
              style={{ whiteSpace: 'nowrap' }}
            >
              Change Workspace
            </button>
          </div>
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            marginTop: '0.75rem',
            opacity: 0.8
          }}>
            Select a different folder to use as your workspace. The app will reload after changing the workspace.
          </p>
        </div>
      </section>

      <section id="typography" className="settings-section">
        <div className="settings-section-header">
          <h2>Typography</h2>
          <div className="settings-section-actions">
            <button className="btn btn-secondary" onClick={resetFontSettings}>
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="settings-typography-grid">
          <h3 style={{ gridColumn: '1 / -1', marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
            📖 Content Font (Reading Area)
          </h3>

          <div className="settings-typography-row">
            <div className="settings-typography-field">
              <label>Font Family</label>
              <select
                value={fontSettings.contentFontFamily}
                onChange={(e) => updateFont({ contentFontFamily: e.target.value })}
                className="settings-select"
              >
                {SANS_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-typography-field">
              <label>Font Size: {fontSettings.contentFontSize}px</label>
              <input
                type="range"
                min={14}
                max={22}
                step={1}
                value={fontSettings.contentFontSize}
                onChange={(e) => updateFont({ contentFontSize: Number(e.target.value) })}
                className="settings-range"
              />
              <div className="settings-range-labels">
                <span>14px</span>
                <span>22px</span>
              </div>
            </div>
          </div>

          <div className="settings-typography-row">
            <div className="settings-typography-field">
              <label>Line Height: {fontSettings.contentLineHeight.toFixed(1)}</label>
              <input
                type="range"
                min={1.4}
                max={2.2}
                step={0.1}
                value={fontSettings.contentLineHeight}
                onChange={(e) => updateFont({ contentLineHeight: Number(e.target.value) })}
                className="settings-range"
              />
              <div className="settings-range-labels">
                <span>1.4</span>
                <span>2.2</span>
              </div>
            </div>

            <div className="settings-typography-field">
              <label>Monospace Font (Code Blocks)</label>
              <select
                value={fontSettings.monoFontFamily}
                onChange={(e) => updateFont({ monoFontFamily: e.target.value })}
                className="settings-select"
              >
                {MONO_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <h3 style={{ gridColumn: '1 / -1', marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
            🎨 UI Font (Controls & Sidebar)
          </h3>

          <div className="settings-typography-row">
            <div className="settings-typography-field">
              <label>Font Family</label>
              <select
                value={fontSettings.uiFontFamily}
                onChange={(e) => updateFont({ uiFontFamily: e.target.value })}
                className="settings-select"
              >
                {SANS_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-typography-field">
              <label>Font Size: {fontSettings.uiFontSize}px</label>
              <input
                type="range"
                min={12}
                max={18}
                step={1}
                value={fontSettings.uiFontSize}
                onChange={(e) => updateFont({ uiFontSize: Number(e.target.value) })}
                className="settings-range"
              />
              <div className="settings-range-labels">
                <span>12px</span>
                <span>18px</span>
              </div>
            </div>
          </div>

          <div className="settings-typography-row">
            <h3 style={{ gridColumn: '1 / -1', marginTop: '1rem', marginBottom: '0.5rem' }}>Heading Colors</h3>

            <div className="settings-typography-field">
              <label>H1 Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={fontSettings.headingColors.h1 === 'inherit' ? '#1a1a1a' : fontSettings.headingColors.h1}
                  onChange={(e) => updateFont({ headingColors: { ...fontSettings.headingColors, h1: e.target.value } })}
                  className="settings-color-input"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => updateFont({ headingColors: { ...fontSettings.headingColors, h1: 'inherit' } })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="settings-typography-field">
              <label>H2 Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={fontSettings.headingColors.h2 === 'inherit' ? '#1a1a1a' : fontSettings.headingColors.h2}
                  onChange={(e) => updateFont({ headingColors: { ...fontSettings.headingColors, h2: e.target.value } })}
                  className="settings-color-input"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => updateFont({ headingColors: { ...fontSettings.headingColors, h2: 'inherit' } })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="settings-typography-field">
              <label>H3 Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={fontSettings.headingColors.h3 === 'inherit' ? '#1a1a1a' : fontSettings.headingColors.h3}
                  onChange={(e) => updateFont({ headingColors: { ...fontSettings.headingColors, h3: e.target.value } })}
                  className="settings-color-input"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => updateFont({ headingColors: { ...fontSettings.headingColors, h3: 'inherit' } })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="settings-typography-field">
              <label>H4 Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={fontSettings.headingColors.h4 === 'inherit' ? '#1a1a1a' : fontSettings.headingColors.h4}
                  onChange={(e) => updateFont({ headingColors: { ...fontSettings.headingColors, h4: e.target.value } })}
                  className="settings-color-input"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => updateFont({ headingColors: { ...fontSettings.headingColors, h4: 'inherit' } })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="settings-typography-preview">
            <p className="settings-typography-preview-label">Preview</p>

            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Content Font (Reading)</p>
              <h1 style={{
                color: fontSettings.headingColors.h1,
                marginBottom: '0.5rem',
                fontFamily: fontSettings.contentFontFamily === 'System Default'
                  ? '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                  : `'${fontSettings.contentFontFamily}', sans-serif`,
                fontSize: `${fontSettings.contentFontSize * 1.75}px`,
              }}>
                Heading 1 Preview
              </h1>
              <h2 style={{
                color: fontSettings.headingColors.h2,
                marginBottom: '0.5rem',
                fontFamily: fontSettings.contentFontFamily === 'System Default'
                  ? '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                  : `'${fontSettings.contentFontFamily}', sans-serif`,
                fontSize: `${fontSettings.contentFontSize * 1.5}px`,
              }}>
                Heading 2 Preview
              </h2>
              <p
                style={{
                  fontFamily: fontSettings.contentFontFamily === 'System Default'
                    ? '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                    : `'${fontSettings.contentFontFamily}', sans-serif`,
                  fontSize: `${fontSettings.contentFontSize}px`,
                  lineHeight: fontSettings.contentLineHeight,
                  marginBottom: '0.5rem',
                }}
              >
                The quick brown fox jumps over the lazy dog. 빠른 갈색 여우가 게으른 개를 뛰어넘습니다. 0123456789
              </p>
              <p
                style={{
                  fontFamily: `'${fontSettings.monoFontFamily}', monospace`,
                  fontSize: `${fontSettings.contentFontSize * 0.9}px`,
                  lineHeight: fontSettings.contentLineHeight,
                }}
              >
                {'const hello = "world"; // monospace code'}
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>UI Font (Controls)</p>
              <p
                style={{
                  fontFamily: fontSettings.uiFontFamily === 'System Default'
                    ? '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
                    : `'${fontSettings.uiFontFamily}', sans-serif`,
                  fontSize: `${fontSettings.uiFontSize}px`,
                }}
              >
                Sidebar, buttons, and control elements use this font. 사이드바 및 컨트롤 요소.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="board-appearance" className="settings-section">
        <div className="settings-section-header">
          <h2>Board Appearance</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Card Density */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Card Density
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                How much info to show on cards
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setBoardDensity('normal')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: boardDensity === 'normal' ? 'var(--accent-primary)' : 'transparent',
                  color: boardDensity === 'normal' ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${boardDensity === 'normal' ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Normal
              </button>
              <button
                onClick={() => setBoardDensity('compact')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: boardDensity === 'compact' ? 'var(--accent-primary)' : 'transparent',
                  color: boardDensity === 'compact' ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${boardDensity === 'compact' ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Compact
              </button>
            </div>
          </div>

          {/* Page Width */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Page Width
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                Content width on page views
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPageWidth('narrow')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: pageWidth === 'narrow' ? 'var(--accent-primary)' : 'transparent',
                  color: pageWidth === 'narrow' ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${pageWidth === 'narrow' ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Narrow
              </button>
              <button
                onClick={() => setPageWidth('wide')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: pageWidth === 'wide' ? 'var(--accent-primary)' : 'transparent',
                  color: pageWidth === 'wide' ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${pageWidth === 'wide' ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Wide
              </button>
            </div>
          </div>

          {/* WYSIWYG Editor (Phase 0 Testing) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                WYSIWYG Editor (Experimental)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                Enable Notion-like WYSIWYG editing (Phase 0 - Testing)
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setUseWYSIWYG(false)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: !useWYSIWYG ? 'var(--accent-primary)' : 'transparent',
                  color: !useWYSIWYG ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${!useWYSIWYG ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Classic
              </button>
              <button
                onClick={() => setUseWYSIWYG(true)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: useWYSIWYG ? 'var(--accent-primary)' : 'transparent',
                  color: useWYSIWYG ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${useWYSIWYG ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                WYSIWYG
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="highlight-colors" className="settings-section">
        <div className="settings-section-header">
          <h2>Highlight Colors</h2>
        </div>
        <p className="settings-section-description">
          Customize the colors available in the text highlighter palette (up to 10 colors).
          Colors are automatically adjusted for optimal visibility in dark mode.
        </p>
        <div className="settings-highlight-colors">
          {highlightColors.map((color, index) => (
            <div key={index} className="settings-highlight-color-item">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  const newColors = [...highlightColors];
                  newColors[index] = e.target.value;
                  setHighlightColors(newColors);
                }}
                className="settings-highlight-color-input"
              />
              <button
                className="btn-icon-small"
                onClick={() => {
                  if (highlightColors.length > 1) {
                    const newColors = highlightColors.filter((_, i) => i !== index);
                    setHighlightColors(newColors);
                  }
                }}
                disabled={highlightColors.length <= 1}
                title="Remove color"
              >
                ✕
              </button>
            </div>
          ))}
          {highlightColors.length < 10 && (
            <button
              className="btn-add-highlight-color"
              onClick={() => {
                setHighlightColors([...highlightColors, '#FFEB3B']);
              }}
              title="Add color"
            >
              + Add Color
            </button>
          )}
        </div>
        <button
          className="btn-reset-highlight-colors"
          onClick={() => {
            setHighlightColors(['#FFEB3B', '#C5E1A5', '#90CAF9', '#FFCC80', '#F48FB1']);
          }}
        >
          Reset to Defaults
        </button>
      </section>

      <section id="column-colors" className="settings-section">
        <div className="settings-section-header">
          <h2>Column Colors</h2>
        </div>

        {existingColumns.length === 0 ? (
          <p className="settings-empty-hint">No columns yet. Assign a column to a page to see it here.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}>
            {existingColumns.map((col) => {
              const color = getColumnColor(col);
              const isCustom = !!columnColors[col.toLowerCase()];
              return (
                <div key={col} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '3px',
                    backgroundColor: color,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    flex: 1,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColumnColor(col, e.target.value)}
                    style={{
                      width: '28px',
                      height: '28px',
                      padding: '2px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      backgroundColor: color,
                    }}
                    title={`Change color for "${col}"`}
                  />
                  {isCustom && (
                    <button
                      onClick={() => removeColumnColor(col)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Reset to default"
                    >
                      ↻
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {needsMigration && (
        <section id="migration" className="settings-section">
          <div className="settings-section-header">
            <h2>⚠️ Migration Required</h2>
          </div>
          <p className="settings-description">
            Your workspace uses the old folder-based structure.
            Migrate to the new file-based structure to use the latest features like page links and improved performance.
          </p>
          <div className="settings-migration-info">
            <h4>What will happen:</h4>
            <ul>
              <li>Each <code>workspace/Page/index.md</code> → <code>workspace/Page.md</code></li>
              <li>All images moved to <code>workspace/.images/</code></li>
              <li>Nested pages will get <code>parentId</code> field set</li>
              <li>Old folders will be deleted</li>
            </ul>
            <p><strong>⚠️ Important: Create a backup before proceeding!</strong></p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleMigrate}
            disabled={isMigrating}
          >
            {isMigrating ? 'Migrating...' : 'Start Migration'}
          </button>
          {migrationResult && (
            <pre className="settings-migration-result">{migrationResult}</pre>
          )}
        </section>
      )}

      <section id="slash-commands" className="settings-section">
        <div className="settings-section-header">
          <h2>Slash Commands</h2>
          <div className="settings-section-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset to Defaults
            </button>
            <button className="btn btn-primary" onClick={startAdd}>
              + Add Command
            </button>
          </div>
        </div>

        {isAdding && renderForm()}

        <div className="settings-commands-list">
          {slashCommands.map((cmd) => (
            <div key={cmd.id}>
              <div className="settings-command-row">
                <span className="settings-cmd-icon">{cmd.icon}</span>
                <span className="settings-cmd-key">/{cmd.key}</span>
                <span className="settings-cmd-label">{cmd.label}</span>
                {cmd.builtin && <span className="settings-cmd-badge">built-in</span>}
                <div className="settings-cmd-actions">
                  <button className="settings-cmd-btn" onClick={() => startEdit(cmd)}>
                    Edit
                  </button>
                  <button
                    className="settings-cmd-btn settings-cmd-btn-danger"
                    onClick={() => handleDelete(cmd)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {editingId === cmd.id && renderForm()}
            </div>
          ))}
        </div>
      </section>
      <section id="keyboard-shortcuts" className="settings-section">
        <h2>Keyboard Shortcuts</h2>

        <h3 className="shortcuts-group-title">Page View (Reading Mode)</h3>
        <div className="shortcuts-table">
          <div className="shortcut-row">
            <kbd>E</kbd>
            <span>Enter edit mode</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ E</kbd>
            <span>Enter edit mode</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ F</kbd>
            <span>Find in page</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ M</kbd>
            <span>Toggle memo panel</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ ⇧ M</kbd>
            <span>Create new memo</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ ⇧ I</kbd>
            <span>Toggle immerse mode</span>
          </div>
          <div className="shortcut-row">
            <kbd>Esc</kbd>
            <span>Exit immerse mode</span>
          </div>
        </div>

        <h3 className="shortcuts-group-title">Editor (Editing Mode)</h3>
        <div className="shortcuts-table">
          <div className="shortcut-row">
            <kbd>⌘ S</kbd>
            <span>Save page</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ F</kbd>
            <span>Find &amp; replace</span>
          </div>
          <div className="shortcut-row">
            <kbd>Esc</kbd>
            <span>Save and exit edit mode</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ B</kbd>
            <span>Bold text</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ I</kbd>
            <span>Italic text</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘ E</kbd>
            <span>Inline code</span>
          </div>
          <div className="shortcut-row">
            <kbd>Tab</kbd>
            <span>Indent line / insert spaces</span>
          </div>
          <div className="shortcut-row">
            <kbd>⇧ Tab</kbd>
            <span>Dedent line</span>
          </div>
          <div className="shortcut-row">
            <kbd>Enter</kbd>
            <span>Continue list item (in lists)</span>
          </div>
          <div className="shortcut-row">
            <kbd>/</kbd>
            <span>Open slash command palette</span>
          </div>
        </div>
      </section>
        </div>
      </div>
    </div>
  );
}
