// مقارنة أداء Dijkstra (Min-Heap) مع A* ومع Dijkstra التقليدي بدون Heap للتقرير والعرض
// التشغيل: node server/algorithms/dijkstra.benchmark.js
const { dijkstra, aStar, haversineDistance } = require('./dijkstra');

const GRID_SIZES = [
  { label: '100 عقدة (10×10)', side: 10 },
  { label: '900 عقدة (30×30)', side: 30 },
  { label: '2500 عقدة (50×50)', side: 50 },
];

function generateRoadGrid(side) {
  const nodes = [];
  const edges = [];
  const baseLat = 30.0;
  const baseLng = 31.0;
  const step = 0.01;

  for (let r = 0; r < side; r++) {
    for (let c = 0; c < side; c++) {
      nodes.push({
        id: `N_${r}_${c}`,
        lat: baseLat + r * step,
        lng: baseLng + c * step,
        type: 'intersection',
      });
    }
  }

  const addRoad = (r1, c1, r2, c2) => {
    const u = nodes[r1 * side + c1];
    const v = nodes[r2 * side + c2];
    const air = haversineDistance(u.lat, u.lng, v.lat, v.lng);
    edges.push({
      from: u.id,
      to: v.id,
      distance: Number((air * 1.18).toFixed(3)),
    });
  };

  for (let r = 0; r < side; r++) {
    for (let c = 0; c < side; c++) {
      if (r + 1 < side) addRoad(r, c, r + 1, c);
      if (c + 1 < side) addRoad(r, c, r, c + 1);
    }
  }

  const s = Math.floor(side * 0.2);
  const t = Math.floor(side * 0.75);
  return {
    graph: { nodes, edges },
    startId: `N_${s}_${s}`,
    endId: `N_${t}_${t}`,
  };
}

// نسخة بدون Heap (مسح خطي O(V^2)) للمقارنة في التقرير
function naiveDijkstraLinear(startId, endId, graph) {
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    adj.get(e.from).push({ to: e.to, weight: e.distance });
    adj.get(e.to).push({ to: e.from, weight: e.distance });
  }

  const dist = new Map([[startId, 0]]);
  const visited = new Set();

  while (visited.size < graph.nodes.length) {
    let u = null;
    let best = Infinity;
    for (const [id, d] of dist.entries()) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null || u === endId) break;
    visited.add(u);

    for (const { to, weight } of adj.get(u)) {
      if (visited.has(to)) continue;
      const cand = best + weight;
      if (cand < (dist.get(to) ?? Infinity)) {
        dist.set(to, cand);
      }
    }
  }

  return { distance: Math.round((dist.get(endId) ?? Infinity) * 100) / 100, visitedCount: visited.size };
}

const rows = GRID_SIZES.map(({ label, side }) => {
  const { graph, startId, endId } = generateRoadGrid(side);

  const t0 = performance.now();
  const heapRes = dijkstra(startId, endId, graph);
  const heapMs = performance.now() - t0;

  const t1 = performance.now();
  const aStarRes = aStar(startId, endId, graph);
  const aStarMs = performance.now() - t1;

  const t2 = performance.now();
  const linearRes = naiveDijkstraLinear(startId, endId, graph);
  const linearMs = performance.now() - t2;

  if (heapRes.distance !== aStarRes.distance || heapRes.distance !== linearRes.distance) {
    throw new Error(`Distance mismatch on ${label}`);
  }

  return {
    الشبكة: label,
    'المسافة (كم)': heapRes.distance,
    'Dijkstra Heap (ms)': Number(heapMs.toFixed(2)),
    'A* Heuristic (ms)': Number(aStarMs.toFixed(2)),
    'Naive O(V²) (ms)': Number(linearMs.toFixed(2)),
    'عقد Dijkstra': heapRes.visitedCount,
    'عقد A*': aStarRes.visitedCount,
  };
});

console.table(rows);
