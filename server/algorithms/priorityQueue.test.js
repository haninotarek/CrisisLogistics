const test = require('node:test');
const assert = require('node:assert');
const { score, MaxHeap, sortReports } = require('./priorityQueue');

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const report = (id, severity, injured, waited) => ({
  id,
  severity,
  injured_count: injured,
  created_at: minutesAgo(waited),
});

const ids = (reports) => reports.map((r) => r.id);

// سيناريو العرض: 5 بلاغات والأخطر 3 ياخدوا الإسعافات
const scenario = () => [
  report('C', 'Low', 1, 20),
  report('B', 'Medium', 3, 10),
  report('A', 'Critical', 1, 0),
  report('E', 'Medium', 1, 2),
  report('D', 'Critical', 2, 0),
];

test('score follows the formula', () => {
  const expected = { A: 105, B: 75, C: 35, D: 110, E: 57 };
  for (const r of scenario()) {
    assert.strictEqual(score(r), expected[r.id], `report ${r.id}`);
  }
});

test('waiting raises the score by one point per minute', () => {
  const fresh = score(report(1, 'Low', 1, 0));
  const waited = score(report(2, 'Low', 1, 30));
  assert.strictEqual(waited - fresh, 30);
});

test('heap pops the highest score first', () => {
  const heap = new MaxHeap();
  [75, 105, 40, 120].forEach((s) => heap.push({ score: s }));
  assert.strictEqual(heap.a[0].score, 120);

  const popped = [];
  while (heap.size) popped.push(heap.pop().score);
  assert.deepStrictEqual(popped, [120, 105, 75, 40]);
});

test('heap handles empty and single-item cases', () => {
  const heap = new MaxHeap();
  assert.strictEqual(heap.pop(), undefined);
  assert.strictEqual(heap.size, 0);

  heap.push({ score: 7 });
  assert.strictEqual(heap.pop().score, 7);
  assert.strictEqual(heap.size, 0);
});

test('heap order is correct for many random scores', () => {
  const scores = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 300));
  const heap = new MaxHeap();
  scores.forEach((s) => heap.push({ score: s }));

  const popped = [];
  while (heap.size) popped.push(heap.pop().score);
  assert.deepStrictEqual(popped, [...scores].sort((a, b) => b - a));
});

test('sortReports orders the demo scenario by priority', () => {
  assert.deepStrictEqual(ids(sortReports(scenario())), ['D', 'A', 'B', 'E', 'C']);
});

test('the oldest report wins a tie', () => {
  const fixedScore = [
    { id: 'newer', score: 100, created_at: '2026-11-06T10:05:00Z' },
    { id: 'oldest', score: 100, created_at: '2026-11-06T10:00:00Z' },
    { id: 'middle', score: 100, created_at: '2026-11-06T10:02:00Z' },
    { id: 'lower', score: 50, created_at: '2026-11-06T09:00:00Z' },
  ];
  const heap = new MaxHeap();
  fixedScore.forEach((item) => heap.push(item));

  const popped = [];
  while (heap.size) popped.push(heap.pop().id);
  assert.deepStrictEqual(popped, ['oldest', 'middle', 'newer', 'lower']);
});

test('a new report takes its correct place in the order', () => {
  const reports = scenario();
  reports.push(report('NEW', 'Critical', 5, 0));
  assert.deepStrictEqual(ids(sortReports(reports)), ['NEW', 'D', 'A', 'B', 'E', 'C']);
});

test('a long wait lets a simple report pass a newer serious one', () => {
  const reports = [report('medium', 'Medium', 1, 0), report('low', 'Low', 1, 41)];
  assert.deepStrictEqual(ids(sortReports(reports)), ['low', 'medium']);
});

test('sortReports adds score and leaves the input unchanged', () => {
  const input = scenario();
  const snapshot = structuredClone(input);
  const [first] = sortReports(input);

  assert.strictEqual(first.score, 110);
  assert.deepStrictEqual(input, snapshot);
});

test('sortReports returns an empty list for no reports', () => {
  assert.deepStrictEqual(sortReports([]), []);
});
