# Performance Benchmark Suite

Comprehensive benchmarks for measuring the performance impact of architectural improvements in My Kanban.

## 🎯 Purpose

This benchmark suite measures the **3 critical root causes** identified in the PageView component:

1. **ROOT CAUSE #1**: Non-Normalized State Architecture
2. **ROOT CAUSE #2**: Storage Format Write Amplification
3. **ROOT CAUSE #3**: Document-Wide Event Handler Overhead

Each benchmark provides **before/after comparisons** to quantify the performance gains from architectural fixes.

---

## 📊 Benchmark Files

```
src/__tests__/performance/
├── README.md                      # This file
├── benchmark.utils.ts             # Benchmark utilities
├── mock-data.ts                   # Test data generators
├── rootcause1-state.bench.ts      # State management benchmarks
├── rootcause2-io.bench.ts         # I/O and serialization benchmarks
├── rootcause3-dom.bench.ts        # DOM event handler benchmarks
└── run-benchmarks.ts              # Master runner script
```

---

## 🚀 Running Benchmarks

### Run All Benchmarks
```bash
npm test -- --run src/__tests__/performance
```

### Run Individual Benchmarks
```bash
# State management only
npm test -- --run rootcause1-state.bench

# I/O and write amplification only
npm test -- --run rootcause2-io.bench

# DOM event handlers only
npm test -- --run rootcause3-dom.bench
```

### Run with Memory Profiling
```bash
node --expose-gc ./node_modules/.bin/vitest --run src/__tests__/performance
```

---

## 📈 Understanding Results

### Metrics Explained

#### Duration (ms)
- **Lower is better**
- Time to complete the operation
- Example: `50ms` → `10ms` = 5x faster

#### Operations / Ops/sec
- **Higher is better** (for ops/sec)
- Number of operations completed
- Used for counting array scans, DOM traversals, bytes written

#### Memory Δ (Delta)
- **Lower is better**
- Change in heap memory usage
- Negative values mean memory was freed

#### Speedup %
- **Positive is better**
- `+80%` = 80% faster (5x speedup)
- `−20%` = 20% slower (regression)

### Example Output

```
📊 Flat Array - Single Update
   Duration: 45.32ms
   Operations: 100
   Ops/sec: 2,207
   Memory Δ: 2.45 MB

📊 Normalized - Single Update
   Duration: 8.76ms
   Operations: 100
   Ops/sec: 11,416
   Memory Δ: 0.12 MB

🔬 Comparison: Flat Array - Single Update
   Before: 45.32ms
   After:  8.76ms
   ✅ Speedup: 80.7% faster
   Time saved: 36.56ms
   Ops/sec improvement: 9,209
   Memory improvement: 2.33 MB
```

**Interpretation**: Normalized state is **5.2x faster** and uses **95% less memory**.

---

## 🔬 Benchmark Scenarios

### ROOT CAUSE #1: State Updates

| Test | What it Measures | Expected Improvement |
|------|------------------|---------------------|
| Single page update | Time to update one page in store | 5-10x faster |
| Derived computations | Column/tag aggregation overhead | 10-100x faster |
| Tag aggregation | flatMap + dedup operations | 10-100x faster |
| Cascading updates | Multiple sequential updates | 100-500x fewer operations |
| Memory allocation | Array cloning overhead | 80-95% less memory |

**Key Insight**: Flat array creates new reference on every update → all components recalculate.

---

### ROOT CAUSE #2: Write Amplification

| Test | What it Measures | Expected Improvement |
|------|------------------|---------------------|
| Metadata-only update | Bytes written for title change | 100-1000x less I/O |
| Column change | Bytes for 15-byte field update | 1000-5000x less I/O |
| Multi-field update | 5 metadata changes in sequence | 500-2000x less I/O |
| Serialization scaling | Performance by content size | Linear scaling maintained |
| Batched updates | 20 pages updated together | 10-50x less total I/O |

**Key Insight**: Writing 50KB file for 15-byte change = **3,347x write amplification**.

---

### ROOT CAUSE #3: DOM Event Handlers

| Test | What it Measures | Expected Improvement |
|------|------------------|---------------------|
| Non-link clicks | Wasted operations on sidebar/modal clicks | 100% reduction (0 ops) |
| Link clicks | Operations for actual link handling | 30-50% fewer ops |
| DOM traversal cost | closest() + contains() overhead | 50-80% fewer traversals |
| Real-world pattern | Mixed clicks (70% outside, 30% inside) | 60-80% reduction |

**Key Insight**: Document-wide capture handler runs on **every click**, even outside editor.

---

## 📐 Test Scenarios

### Workspace Sizes

```typescript
SCENARIOS = {
  SMALL:  { pages: 50,   contentSize: 2KB  },  // Personal use
  MEDIUM: { pages: 200,  contentSize: 5KB  },  // Small team
  LARGE:  { pages: 500,  contentSize: 10KB },  // Active project
  XLARGE: { pages: 1000, contentSize: 15KB },  // Enterprise
}
```

### Real-World Simulation

Benchmarks simulate realistic user behavior:
- **Editing metadata**: Title → Column → 3 tags → Due date
- **Mixed clicks**: 70% sidebar, 20% text, 10% links
- **Content sizes**: 1KB to 100KB pages
- **Workspaces**: 50 to 1,000 pages

---

## 📊 Tracking Progress

### 1. Establish Baseline (BEFORE)

```bash
# Run benchmarks before optimization
npm test -- --run src/__tests__/performance > benchmarks/baseline.txt
```

### 2. Implement Fixes

Make architectural changes (normalized state, partial I/O, scoped events).

### 3. Measure Improvements (AFTER)

```bash
# Run benchmarks after optimization
npm test -- --run src/__tests__/performance > benchmarks/after-optimization.txt
```

### 4. Compare Results

```bash
# Manual comparison or use diff tool
diff benchmarks/baseline.txt benchmarks/after-optimization.txt
```

---

## 🎯 Success Criteria

### Minimum Viable Improvements

| Root Cause | Metric | Target |
|------------|--------|--------|
| #1: State | Update time | 5x faster |
| #1: State | Array operations | 90% reduction |
| #2: I/O | Write amplification | 100x reduction |
| #2: I/O | Metadata update | 95% less I/O |
| #3: DOM | Non-editor clicks | 100% reduction |
| #3: DOM | DOM traversals | 70% reduction |

### Stretch Goals

- **10x** improvement in state update cascades
- **1000x** reduction in write amplification
- **Zero** DOM operations for non-editor clicks

---

## 🔧 Customizing Benchmarks

### Add New Test Cases

```typescript
it('should measure your custom scenario', async () => {
  const suite = createBenchmarkSuite('Custom Test');

  const result = await benchmark(
    'Test Name',
    () => {
      // Your test code here
    },
    iterations
  );

  suite.addResult(result);
});
```

### Adjust Iteration Counts

```typescript
// Quick test
await benchmark('Quick', fn, 10);

// Thorough test
await benchmark('Thorough', fn, 1000);
```

### Custom Operation Counting

```typescript
await benchmarkWithCounter('Custom Ops', () => {
  let ops = 0;
  // Count specific operations
  pages.forEach(p => ops += p.tags.length);
  return { operationCount: ops };
}, iterations);
```

---

## 📝 Interpreting Failures

### If Benchmarks Fail

1. **Check test expectations**: Adjust thresholds if realistic
2. **Review implementation**: Ensure optimizations are correct
3. **Profile with Chrome DevTools**: Find remaining bottlenecks
4. **Check test data**: Ensure mock data is representative

### Common Issues

- **Memory test fails**: Run with `--expose-gc` flag
- **I/O test fails**: Simulated delays may be too aggressive
- **DOM test fails**: JSDOM environment issues

---

## 🚀 Next Steps

1. ✅ **Establish baseline**: Run benchmarks before optimization
2. 🔨 **Plan architecture**: Review root cause analysis
3. 🏗️ **Implement fixes**: Normalized state → Partial I/O → Scoped events
4. 📊 **Measure results**: Run benchmarks after each fix
5. 🎉 **Document gains**: Update this README with actual improvements

---

## 📚 References

- [Root Cause Analysis](../../docs/performance-analysis.md) *(if exists)*
- [Architecture Plan](../../docs/architecture-plan.md) *(if exists)*
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/performance)
- [React Performance](https://react.dev/learn/render-and-commit)

---

## 💡 Tips

- Run benchmarks on **clean state** (restart Node.js between runs)
- Use **consistent hardware** (same machine for before/after)
- Measure **multiple times** (average of 3+ runs)
- Profile with **realistic data** (use your actual workspace size)
- Focus on **user-facing metrics** (time to update, not just raw ops)

---

Built with ❤️ for performance optimization
