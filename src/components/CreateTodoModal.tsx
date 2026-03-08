import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { pageService } from '@/services';
import { openExternalUrl } from '@/lib/openExternal';
import './CreateTodoModal.css';

interface CreateTodoModalProps {
  onClose: () => void;
}

export function CreateTodoModal({ onClose }: CreateTodoModalProps) {
  const { addPage, pagesArray, config } = useStore();
  const pages = pagesArray;
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [checkItems, setCheckItems] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdCalendarUrl, setCreatedCalendarUrl] = useState<string | null>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Detect existing "todo" column casing, default to "Todo"
  const todoColumn = pages.find(p => p.kanbanColumn?.toLowerCase() === 'todo')?.kanbanColumn || 'Todo';

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddItem = () => {
    const trimmed = currentItem.trim();
    if (!trimmed) return;
    setCheckItems(prev => [...prev, trimmed]);
    setCurrentItem('');
    itemInputRef.current?.focus();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleRemoveItem = (index: number) => {
    setCheckItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Build markdown checklist content
      const content = checkItems.map(item => `- [ ] ${item}`).join('\n');

      const page = await pageService.createPage(config.workspacePath, title.trim(), {
        viewType: 'document',
        kanbanColumn: todoColumn,
        tags: [],
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });

      // Update with checklist content
      if (content) {
        page.content = content;
        await pageService.updatePage(page);
      }

      addPage(page);

      // Build Google Calendar URL
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title.trim(),
      });
      if (dueDate) {
        const dateStr = dueDate.replace(/-/g, '');
        // All-day event: end date is next day (exclusive)
        const nextDay = new Date(dueDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const endStr = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
        params.set('dates', `${dateStr}/${endStr}`);
      }
      if (checkItems.length > 0) {
        params.set('details', checkItems.map(item => `☐ ${item}`).join('\n'));
      }
      setCreatedCalendarUrl(`https://calendar.google.com/calendar/render?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create todo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Todo</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {createdCalendarUrl ? (
          <div className="todo-body">
            <div className="todo-success">
              <span className="material-symbols-outlined todo-success-icon">check_circle</span>
              <p>Todo created!</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                onClick={() => openExternalUrl(createdCalendarUrl)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>calendar_month</span>
                Google Calendar
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
        <div className="todo-body">
          <div className="form-group">
            <label htmlFor="todo-title">Title</label>
            <input
              id="todo-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Todo title..."
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="todo-due">Due Date</label>
            <input
              id="todo-due"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label>Checklist</label>
            <div className="todo-input-row">
              <input
                ref={itemInputRef}
                type="text"
                value={currentItem}
                onChange={e => setCurrentItem(e.target.value)}
                onKeyDown={handleItemKeyDown}
                placeholder="Add item and press Enter..."
                disabled={saving}
              />
              <button
                type="button"
                className="btn-icon todo-add-btn"
                onClick={handleAddItem}
                disabled={saving || !currentItem.trim()}
                title="Add item"
              >
                <span className="material-symbols-outlined">add_circle</span>
              </button>
            </div>

            <div className="todo-list">
              {checkItems.length === 0 ? (
                <div className="todo-empty-hint">
                  Press Enter to add checklist items
                </div>
              ) : (
                checkItems.map((item, index) => (
                  <div key={index} className="todo-item">
                    <span className="material-symbols-outlined todo-item-check">check_box_outline_blank</span>
                    <span className="todo-item-title">{item}</span>
                    <button
                      className="btn-icon todo-item-delete"
                      onClick={() => handleRemoveItem(index)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
