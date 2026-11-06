// مقارنة وقت الـ Heap بالـ Bubble Sort للتقرير
// التشغيل: node server/algorithms/priorityQueue.benchmark.js
const { score, isHigher, sortReports } = require('./priorityQueue');

const SEVERITIES = ['Critical', 'Medium', 'Low'];
const SIZES = [100, 1000, 10000];

function randomReports(count) {
  return Array.from({ length: count }, (_, id) => ({
    id,
    severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
    injured_count: 1 + Math.floor(Math.random() * 5),
    created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
  }));
}

function bubbleSortReports(reports) {
  const a = reports.map((r) => ({ ...r, score: score(r) }));
  for (let end = a.length - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (isHigher(a[i + 1], a[i])) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return a;
}

const isSorted = (a) => a.every((r, i) => i === 0 || !isHigher(r, a[i - 1]));

function timeMs(sort, reports) {
  const start = performance.now();
  const sorted = sort(reports);
  return { ms: performance.now() - start, sorted };
}

const rows = SIZES.map((size) => {
  const reports = randomReports(size);
  const heap = timeMs(sortReports, reports);
  const bubble = timeMs(bubbleSortReports, reports);

  if (!isSorted(heap.sorted) || !isSorted(bubble.sorted)) {
    throw new Error(`Wrong order for ${size} reports`);
  }

  return {
    reports: size,
    'heap (ms)': Number(heap.ms.toFixed(2)),
    'bubble (ms)': Number(bubble.ms.toFixed(2)),
    'bubble / heap': Number((bubble.ms / heap.ms).toFixed(1)),
  };
});

console.table(rows);
