/**
 * Performance monitoring utilities
 * Tracks key metrics for state updates, file I/O, and rendering
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  category: 'state' | 'io' | 'render' | 'dom';
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers = new Map<string, number>();
  private enabled: boolean;
  private maxMetrics = 1000; // Keep last 1000 metrics

  constructor() {
    // Enable in development or when localStorage flag is set
    this.enabled = import.meta.env.DEV || localStorage.getItem('perf-monitor') === 'true';
  }

  /**
   * Start timing an operation
   */
  start(name: string): void {
    if (!this.enabled) return;
    this.timers.set(name, performance.now());
  }

  /**
   * End timing and record metric
   */
  end(name: string, category: PerformanceMetric['category'], metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`[PerformanceMonitor] No start time found for: ${name}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      category,
      metadata,
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    this.checkThresholds(metric);
  }

  /**
   * Measure a function execution
   */
  measure<T>(
    name: string,
    category: PerformanceMetric['category'],
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    if (!this.enabled) return fn();

    this.start(name);
    try {
      const result = fn();
      this.end(name, category, metadata);
      return result;
    } catch (error) {
      this.end(name, category, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure an async function execution
   */
  async measureAsync<T>(
    name: string,
    category: PerformanceMetric['category'],
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) return fn();

    this.start(name);
    try {
      const result = await fn();
      this.end(name, category, metadata);
      return result;
    } catch (error) {
      this.end(name, category, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Check if metric exceeds thresholds and log warnings
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const thresholds = {
      state: 5,    // State updates should be < 5ms
      io: 100,     // File I/O should be < 100ms
      render: 16,  // Render should be < 16ms (60fps)
      dom: 10,     // DOM operations should be < 10ms
    };

    const threshold = thresholds[metric.category];
    if (metric.duration > threshold) {
      console.warn(
        `[PerformanceMonitor] Slow ${metric.category} operation: ${metric.name} took ${metric.duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        metric.metadata
      );
    }
  }

  /**
   * Get metrics summary for a category
   */
  getSummary(category?: PerformanceMetric['category']): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
  } {
    const filtered = category
      ? this.metrics.filter(m => m.category === category)
      : this.metrics;

    if (filtered.length === 0) {
      return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0, totalDuration: 0 };
    }

    const durations = filtered.map(m => m.duration);
    return {
      count: filtered.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / filtered.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  /**
   * Get recent metrics (last N)
   */
  getRecent(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get all metrics
   */
  getAll(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    if (!this.enabled) {
      console.log('[PerformanceMonitor] Monitoring is disabled');
      return;
    }

    console.group('📊 Performance Summary');

    const categories: PerformanceMetric['category'][] = ['state', 'io', 'render', 'dom'];
    categories.forEach(category => {
      const summary = this.getSummary(category);
      if (summary.count > 0) {
        console.log(
          `${category.toUpperCase()}: ${summary.count} ops, avg: ${summary.avgDuration.toFixed(2)}ms, min: ${summary.minDuration.toFixed(2)}ms, max: ${summary.maxDuration.toFixed(2)}ms`
        );
      }
    });

    console.groupEnd();
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('perf-monitor', enabled ? 'true' : 'false');
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).__perfMonitor = perfMonitor;
}

/**
 * React hook for component render timing
 */
export function useRenderTiming(componentName: string): void {
  if (!perfMonitor.isEnabled()) return;

  // Using useEffect to measure render time
  // This runs after the DOM is updated
  React.useEffect(() => {
    perfMonitor.end(componentName, 'render', { type: 'component' });
  });

  perfMonitor.start(componentName);
}

// Re-export for convenience
import React from 'react';
export type { PerformanceMetric };
