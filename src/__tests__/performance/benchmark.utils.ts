/**
 * Performance Benchmarking Utilities
 * Measures time, memory, and operation counts for performance testing
 */

export interface BenchmarkResult {
  name: string;
  duration: number;  // milliseconds
  operations: number;
  opsPerSecond: number;
  memoryDelta?: number;  // bytes
  metadata?: Record<string, any>;
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  timestamp: string;
}

/**
 * Measure execution time and operations of a function
 */
export async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number = 1
): Promise<BenchmarkResult> {
  // Warm up
  if (iterations > 1) {
    await fn();
  }

  // Force garbage collection if available (Node.js with --expose-gc)
  if (global.gc) {
    global.gc();
  }

  const memBefore = (performance as any).memory?.usedJSHeapSize || 0;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  const end = performance.now();
  const memAfter = (performance as any).memory?.usedJSHeapSize || 0;

  const duration = end - start;
  const opsPerSecond = (iterations / duration) * 1000;

  return {
    name,
    duration,
    operations: iterations,
    opsPerSecond,
    memoryDelta: memAfter - memBefore,
  };
}

/**
 * Measure a function with custom operation counting
 */
export async function benchmarkWithCounter(
  name: string,
  fn: () => { operationCount: number } | Promise<{ operationCount: number }>,
  iterations: number = 1
): Promise<BenchmarkResult> {
  const memBefore = (performance as any).memory?.usedJSHeapSize || 0;
  const start = performance.now();

  let totalOps = 0;
  for (let i = 0; i < iterations; i++) {
    const result = await fn();
    totalOps += result.operationCount;
  }

  const end = performance.now();
  const memAfter = (performance as any).memory?.usedJSHeapSize || 0;

  const duration = end - start;
  const opsPerSecond = (totalOps / duration) * 1000;

  return {
    name,
    duration,
    operations: totalOps,
    opsPerSecond,
    memoryDelta: memAfter - memBefore,
    metadata: { iterations, avgOpsPerIteration: totalOps / iterations },
  };
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarks(
  before: BenchmarkResult,
  after: BenchmarkResult
): {
  speedupPercent: number;
  timeSaved: number;
  opsImprovement: number;
  memoryImprovement?: number;
} {
  const speedupPercent = ((before.duration - after.duration) / before.duration) * 100;
  const timeSaved = before.duration - after.duration;
  const opsImprovement = after.opsPerSecond - before.opsPerSecond;

  const memoryImprovement =
    before.memoryDelta && after.memoryDelta
      ? before.memoryDelta - after.memoryDelta
      : undefined;

  return {
    speedupPercent,
    timeSaved,
    opsImprovement,
    memoryImprovement,
  };
}

/**
 * Format benchmark result for display
 */
export function formatBenchmark(result: BenchmarkResult): string {
  const lines = [
    `\n📊 ${result.name}`,
    `   Duration: ${result.duration.toFixed(2)}ms`,
    `   Operations: ${result.operations.toLocaleString()}`,
    `   Ops/sec: ${result.opsPerSecond.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  ];

  if (result.memoryDelta) {
    lines.push(`   Memory Δ: ${formatBytes(result.memoryDelta)}`);
  }

  if (result.metadata) {
    lines.push(`   Metadata: ${JSON.stringify(result.metadata)}`);
  }

  return lines.join('\n');
}

/**
 * Format comparison for display
 */
export function formatComparison(
  before: BenchmarkResult,
  after: BenchmarkResult
): string {
  const comparison = compareBenchmarks(before, after);
  const improved = comparison.speedupPercent > 0;

  const lines = [
    `\n🔬 Comparison: ${before.name}`,
    `   Before: ${before.duration.toFixed(2)}ms`,
    `   After:  ${after.duration.toFixed(2)}ms`,
    `   ${improved ? '✅' : '❌'} Speedup: ${comparison.speedupPercent.toFixed(1)}% ${improved ? 'faster' : 'slower'}`,
    `   Time saved: ${comparison.timeSaved.toFixed(2)}ms`,
    `   Ops/sec improvement: ${comparison.opsImprovement.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  ];

  if (comparison.memoryImprovement !== undefined) {
    lines.push(
      `   Memory improvement: ${formatBytes(comparison.memoryImprovement)}`
    );
  }

  return lines.join('\n');
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (Math.abs(bytes) < 1024) return `${bytes} B`;
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Create a benchmark suite
 */
export function createBenchmarkSuite(name: string): {
  addResult: (result: BenchmarkResult) => void;
  finish: () => BenchmarkSuite;
  print: () => void;
} {
  const results: BenchmarkResult[] = [];
  const startTime = performance.now();

  return {
    addResult: (result: BenchmarkResult) => {
      results.push(result);
      console.log(formatBenchmark(result));
    },

    finish: () => {
      const totalDuration = performance.now() - startTime;
      return {
        name,
        results,
        totalDuration,
        timestamp: new Date().toISOString(),
      };
    },

    print: () => {
      const suite = {
        name,
        results,
        totalDuration: performance.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📈 Benchmark Suite: ${suite.name}`);
      console.log(`   Timestamp: ${suite.timestamp}`);
      console.log(`   Total Duration: ${suite.totalDuration.toFixed(2)}ms`);
      console.log(`   Tests: ${suite.results.length}`);
      console.log(`${'='.repeat(60)}`);

      suite.results.forEach((result) => {
        console.log(formatBenchmark(result));
      });

      console.log(`\n${'='.repeat(60)}\n`);
    },
  };
}
