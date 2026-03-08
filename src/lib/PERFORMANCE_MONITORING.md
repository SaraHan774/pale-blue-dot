# Performance Monitoring

## Overview
Built-in performance monitoring system for tracking state updates, file I/O, rendering, and DOM operations.

## Features
- **Automatic tracking** of critical operations
- **Threshold warnings** for slow operations
- **Console access** via `window.__perfMonitor`
- **Development mode** enabled by default
- **Production mode** via localStorage flag

## Usage

### Enable/Disable Monitoring
```javascript
// Enable in production (persists to localStorage)
window.__perfMonitor.setEnabled(true);

// Disable
window.__perfMonitor.setEnabled(false);

// Check status
window.__perfMonitor.isEnabled();
```

### View Performance Summary
```javascript
// Print summary to console
window.__perfMonitor.printSummary();

// Get summary for specific category
window.__perfMonitor.getSummary('state');
window.__perfMonitor.getSummary('io');
window.__perfMonitor.getSummary('render');
window.__perfMonitor.getSummary('dom');

// Get recent metrics
window.__perfMonitor.getRecent(20);

// Get all metrics
window.__perfMonitor.getAll();

// Clear metrics
window.__perfMonitor.clear();
```

### Example Output
```
📊 Performance Summary
STATE: 45 ops, avg: 1.23ms, min: 0.50ms, max: 3.45ms
IO: 12 ops, avg: 8.67ms, min: 4.20ms, max: 15.30ms
RENDER: 89 ops, avg: 2.10ms, min: 0.80ms, max: 5.60ms
DOM: 156 ops, avg: 0.45ms, min: 0.10ms, max: 2.30ms
```

## Automatic Instrumentation

### State Operations
Automatically tracked:
- `store.setPages` - Loading all pages
- `store.addPage` - Adding a new page
- `store.updatePage` - Updating a page

### File I/O Operations
Automatically tracked:
- `pageService.updateMetadata` - Metadata-only updates
- `pageService.updatePage` - Full page updates

## Thresholds & Warnings

Operations that exceed these thresholds trigger console warnings:

| Category | Threshold | Purpose |
|----------|-----------|---------|
| State | 5ms | State updates should be fast |
| I/O | 100ms | File operations can be slower |
| Render | 16ms | Maintain 60fps |
| DOM | 10ms | DOM operations should be quick |

### Example Warning
```
⚠️ [PerformanceMonitor] Slow state operation: store.updatePage took 12.45ms (threshold: 5ms)
{ pageId: "abc-123" }
```

## Manual Instrumentation

### Synchronous Operations
```typescript
import { perfMonitor } from '@/lib/performance';

function myOperation() {
  return perfMonitor.measure('myOperation', 'state', () => {
    // Your code here
    return result;
  }, { customMetadata: 'value' });
}
```

### Async Operations
```typescript
async function myAsyncOperation() {
  return perfMonitor.measureAsync('myAsyncOp', 'io', async () => {
    // Your async code here
    return result;
  }, { userId: '123' });
}
```

### Manual Start/End
```typescript
perfMonitor.start('operation-name');
try {
  // Do work
} finally {
  perfMonitor.end('operation-name', 'state', { metadata: 'here' });
}
```

## React Hook Usage

### Component Render Timing
```typescript
import { useRenderTiming } from '@/lib/performance';

function MyComponent() {
  useRenderTiming('MyComponent');

  return <div>...</div>;
}
```

## Best Practices

1. **Use in development**: Enabled by default in dev mode
2. **Check console**: Warnings appear for slow operations
3. **Profile before optimizing**: Use `printSummary()` to identify bottlenecks
4. **Clear between tests**: Use `clear()` to reset metrics
5. **Disable in production**: Unless actively debugging

## Integration Points

### Current Integrations
- ✅ Zustand store (setPages, addPage, updatePage)
- ✅ Page service (updateMetadata, updatePage)
- ❌ Selectors (not instrumented - too fast)
- ❌ Components (not instrumented - use manually if needed)

### Adding New Instrumentation
When adding instrumentation, consider:
- **Overhead**: Monitoring adds ~0.1-0.3ms overhead
- **Value**: Only track operations that could be slow
- **Category**: Choose appropriate category (state/io/render/dom)
- **Metadata**: Include useful context for debugging

## Performance Impact

The monitoring system itself has minimal overhead:
- **Enabled**: ~0.1-0.3ms per operation
- **Disabled**: Near-zero (early return)
- **Memory**: Keeps last 1000 metrics

## Troubleshooting

### No metrics appearing
- Check if enabled: `window.__perfMonitor.isEnabled()`
- Enable: `window.__perfMonitor.setEnabled(true)`

### Too many warnings
- Thresholds are conservative
- Review code for actual slowness
- Adjust thresholds if needed (in source)

### Missing operations
- Check if instrumentation is in place
- Verify category and name match expectations

## Future Enhancements
- [ ] Performance overlay UI
- [ ] Export metrics to file
- [ ] Integration with React DevTools
- [ ] Real-time charts
- [ ] Alert on regressions
