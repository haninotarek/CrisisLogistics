const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SPEED_KMH = 60;
const EARTH_RADIUS_KM = 6371;

// قراءة شبكة الطرق الافتراضية من server/data/graph.json
const defaultGraphPath = path.join(__dirname, '..', 'data', 'graph.json');
const defaultGraph = JSON.parse(fs.readFileSync(defaultGraphPath, 'utf8'));

// Min-Heap لترتيب العقد حسب أقل تكلفة مسار في O(log V)
class MinHeap {
  constructor() {
    this.a = [];
  }

  push(item) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.a[i].priority >= this.a[p].priority) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }

  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l].priority < this.a[m].priority) m = l;
        if (r < this.a.length && this.a[r].priority < this.a[m].priority) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
    return top;
  }

  get size() {
    return this.a.length;
  }
}

// حساب المسافة الهوائية بالكيلومتر (Haversine) لاستخدامها في A* وربط إحداثيات GPS
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

// تحويل graph.json (أو أي Adjacency Object مخصص) إلى خريطة عقد وقائمة جيران جاهزة للبحث
function buildAdjacency(graph = defaultGraph) {
  if (graph && graph._adjCache) return graph._adjCache;

  const nodeMap = new Map();
  const adj = new Map();

  // الشكل الأساسي: { nodes: [...], edges: [...] }
  if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node);
      adj.set(node.id, []);
    }
    for (const edge of graph.edges) {
      const weight = Number(edge.distance ?? edge.weight ?? 0);
      if (!adj.has(edge.from)) adj.set(edge.from, []);
      if (!adj.has(edge.to)) adj.set(edge.to, []);
      adj.get(edge.from).push({ to: edge.to, weight });
      if (edge.bidirectional !== false) {
        adj.get(edge.to).push({ to: edge.from, weight });
      }
    }
    const built = { nodeMap, adj };
    if (graph === defaultGraph) graph._adjCache = built;
    return built;
  }

  // دعم إضافي لو اتبعت Graph على شكل Adjacency Object: { A: { B: 1.2 } }
  for (const [u, neighbors] of Object.entries(graph || {})) {
    if (!nodeMap.has(u)) nodeMap.set(u, { id: u });
    if (!adj.has(u)) adj.set(u, []);
    for (const [v, weight] of Object.entries(neighbors || {})) {
      if (!nodeMap.has(v)) nodeMap.set(v, { id: v });
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u).push({ to: v, weight: Number(weight) });
    }
  }
  return { nodeMap, adj };
}

function formatRouteResult({ found, algorithm, pathIds, distanceKm, visitedCount, nodeMap, speedKmh = DEFAULT_SPEED_KMH }) {
  if (!found) {
    return {
      found: false,
      algorithm,
      path: [],
      nodes: [],
      coordinates: [],
      distance: Infinity,
      etaMinutes: Infinity,
      visitedCount,
    };
  }

  const distance = Math.round(distanceKm * 100) / 100;
  const etaMinutes = distance === 0 ? 0 : Math.max(1, Math.round((distance / speedKmh) * 60 * 10) / 10);
  const nodes = pathIds.map((id) => nodeMap.get(id) || { id });
  const coordinates = nodes
    .filter((n) => typeof n.lat === 'number' && typeof n.lng === 'number')
    .map((n) => [n.lat, n.lng]);

  return {
    found: true,
    algorithm,
    path: pathIds,
    nodes,
    coordinates,
    distance,
    etaMinutes,
    visitedCount,
  };
}

// خوارزمية Dijkstra لإيجاد أقصر مسار مضمون بين أي نقطتين على الشبكة
function dijkstra(startId, endId, graph = defaultGraph, options = {}) {
  const { nodeMap, adj } = buildAdjacency(graph);
  const speedKmh = options.speedKmh || DEFAULT_SPEED_KMH;

  if (!adj.has(startId) || !adj.has(endId)) {
    return formatRouteResult({ found: false, algorithm: 'dijkstra', pathIds: [], distanceKm: Infinity, visitedCount: 0, nodeMap, speedKmh });
  }

  if (startId === endId) {
    return formatRouteResult({ found: true, algorithm: 'dijkstra', pathIds: [startId], distanceKm: 0, visitedCount: 1, nodeMap, speedKmh });
  }

  const dist = new Map([[startId, 0]]);
  const prev = new Map();
  const visited = new Set();
  const heap = new MinHeap();
  heap.push({ id: startId, priority: 0 });

  while (heap.size > 0) {
    const { id: current, priority: currentDist } = heap.pop();
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    for (const { to, weight } of adj.get(current) || []) {
      if (visited.has(to)) continue;
      const candidate = currentDist + weight;
      if (candidate < (dist.get(to) ?? Infinity)) {
        dist.set(to, candidate);
        prev.set(to, current);
        heap.push({ id: to, priority: candidate });
      }
    }
  }

  if (!dist.has(endId)) {
    return formatRouteResult({ found: false, algorithm: 'dijkstra', pathIds: [], distanceKm: Infinity, visitedCount: visited.size, nodeMap, speedKmh });
  }

  const pathIds = [];
  for (let cur = endId; cur !== undefined; cur = prev.get(cur)) {
    pathIds.push(cur);
  }
  pathIds.reverse();

  return formatRouteResult({
    found: true,
    algorithm: 'dijkstra',
    pathIds,
    distanceKm: dist.get(endId),
    visitedCount: visited.size,
    nodeMap,
    speedKmh,
  });
}

// خوارزمية A* مع دالة إرشادية (Haversine) لتسريع الوصول للهدف مع الحفاظ على نفس أقصر مسار
function aStar(startId, endId, graph = defaultGraph, options = {}) {
  const { nodeMap, adj } = buildAdjacency(graph);
  const speedKmh = options.speedKmh || DEFAULT_SPEED_KMH;

  if (!adj.has(startId) || !adj.has(endId)) {
    return formatRouteResult({ found: false, algorithm: 'astar', pathIds: [], distanceKm: Infinity, visitedCount: 0, nodeMap, speedKmh });
  }

  if (startId === endId) {
    return formatRouteResult({ found: true, algorithm: 'astar', pathIds: [startId], distanceKm: 0, visitedCount: 1, nodeMap, speedKmh });
  }

  const targetNode = nodeMap.get(endId);
  const heuristic = (id) => {
    const n = nodeMap.get(id);
    if (!n || !targetNode || typeof n.lat !== 'number' || typeof targetNode.lat !== 'number') return 0;
    return haversineDistance(n.lat, n.lng, targetNode.lat, targetNode.lng);
  };

  const gScore = new Map([[startId, 0]]);
  const prev = new Map();
  const closed = new Set();
  const heap = new MinHeap();
  heap.push({ id: startId, priority: heuristic(startId) });

  while (heap.size > 0) {
    const { id: current } = heap.pop();
    if (closed.has(current)) continue;
    closed.add(current);

    if (current === endId) break;

    const currentG = gScore.get(current);
    for (const { to, weight } of adj.get(current) || []) {
      if (closed.has(to)) continue;
      const tentativeG = currentG + weight;
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        gScore.set(to, tentativeG);
        prev.set(to, current);
        heap.push({ id: to, priority: tentativeG + heuristic(to) });
      }
    }
  }

  if (!gScore.has(endId)) {
    return formatRouteResult({ found: false, algorithm: 'astar', pathIds: [], distanceKm: Infinity, visitedCount: closed.size, nodeMap, speedKmh });
  }

  const pathIds = [];
  for (let cur = endId; cur !== undefined; cur = prev.get(cur)) {
    pathIds.push(cur);
  }
  pathIds.reverse();

  return formatRouteResult({
    found: true,
    algorithm: 'astar',
    pathIds,
    distanceKm: gScore.get(endId),
    visitedCount: closed.size,
    nodeMap,
    speedKmh,
  });
}

// إيجاد أقرب عقدة على الشبكة لأي إحداثيات GPS (بلاغ من الموبايل أو موقع مستخدم)
function findNearestNode(lat, lng, typeFilter = null, graph = defaultGraph) {
  const { nodeMap } = buildAdjacency(graph);
  let bestNode = null;
  let bestDist = Infinity;

  for (const node of nodeMap.values()) {
    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') continue;
    if (typeFilter && node.type !== typeFilter) continue;
    const d = haversineDistance(lat, lng, node.lat, node.lng);
    if (d < bestDist) {
      bestDist = d;
      bestNode = node;
    }
  }

  if (!bestNode) return null;
  return {
    node: bestNode,
    snapDistanceKm: Math.round(bestDist * 100) / 100,
  };
}

// حساب أقصر مسار مباشرة بين إحداثيات GPS حقيقية (يربط البداية والنهاية بأقرب عقد الشبكة)
function routeByCoords(fromLat, fromLng, toLat, toLng, graph = defaultGraph, options = {}) {
  const startSnap = findNearestNode(fromLat, fromLng, null, graph);
  const endSnap = findNearestNode(toLat, toLng, null, graph);
  if (!startSnap || !endSnap) {
    return {
      found: false,
      path: [],
      coordinates: [],
      distance: Infinity,
      etaMinutes: Infinity,
    };
  }

  const useAStar = options.algorithm === 'astar';
  const core = useAStar
    ? aStar(startSnap.node.id, endSnap.node.id, graph, options)
    : dijkstra(startSnap.node.id, endSnap.node.id, graph, options);

  if (!core.found) return core;

  const extraDist = startSnap.snapDistanceKm + endSnap.snapDistanceKm;
  const totalDistance = Math.round((core.distance + extraDist) * 100) / 100;
  const speedKmh = options.speedKmh || DEFAULT_SPEED_KMH;
  const etaMinutes = totalDistance === 0 ? 0 : Math.max(1, Math.round((totalDistance / speedKmh) * 60 * 10) / 10);

  const coordinates = [
    [fromLat, fromLng],
    ...core.coordinates,
    [toLat, toLng],
  ];

  return {
    ...core,
    startNode: startSnap.node,
    endNode: endSnap.node,
    distance: totalDistance,
    etaMinutes,
    coordinates,
  };
}

// دالة مساعدة لـ dispatcher.js (فول سوداني): اختيار أقرب سيارة إسعاف متاحة بناءً على مسافة الطريق الفعلية
function findNearestAmbulance(incidentIdOrCoords, candidates = null, graph = defaultGraph) {
  const { nodeMap } = buildAdjacency(graph);

  let targetId = incidentIdOrCoords;
  let snapExtra = 0;
  if (typeof incidentIdOrCoords === 'object' && incidentIdOrCoords !== null) {
    const snap = findNearestNode(incidentIdOrCoords.lat, incidentIdOrCoords.lng, null, graph);
    if (!snap) return null;
    targetId = snap.node.id;
    snapExtra = snap.snapDistanceKm;
  }

  const list =
    candidates ||
    Array.from(nodeMap.values()).filter((n) => n.type === 'ambulance' && n.status !== 'busy');

  let best = null;
  for (const item of list) {
    const ambId = typeof item === 'string' ? item : item.node_id || item.nodeId || item.id;
    const route = dijkstra(ambId, targetId, graph);
    if (!route.found) continue;
    const totalDistance = Math.round((route.distance + snapExtra) * 100) / 100;
    if (!best || totalDistance < best.distance) {
      best = {
        ambulance: typeof item === 'string' ? nodeMap.get(ambId) || { id: ambId } : item,
        route: {
          ...route,
          distance: totalDistance,
        },
        distance: totalDistance,
        etaMinutes: route.etaMinutes,
      };
    }
  }
  return best;
}

// دالة مساعدة لـ dispatcher.js (فول سوداني): اختيار أقرب مستشفى متاح من موقع الحادثة
function findNearestHospital(incidentIdOrCoords, candidates = null, graph = defaultGraph) {
  const { nodeMap } = buildAdjacency(graph);

  let sourceId = incidentIdOrCoords;
  let snapExtra = 0;
  if (typeof incidentIdOrCoords === 'object' && incidentIdOrCoords !== null) {
    const snap = findNearestNode(incidentIdOrCoords.lat, incidentIdOrCoords.lng, null, graph);
    if (!snap) return null;
    sourceId = snap.node.id;
    snapExtra = snap.snapDistanceKm;
  }

  const list =
    candidates ||
    Array.from(nodeMap.values()).filter((n) => n.type === 'hospital' && n.status !== 'full' && n.status !== 'busy');

  let best = null;
  for (const item of list) {
    const hospId = typeof item === 'string' ? item : item.node_id || item.nodeId || item.id;
    const route = dijkstra(sourceId, hospId, graph);
    if (!route.found) continue;
    const totalDistance = Math.round((route.distance + snapExtra) * 100) / 100;
    if (!best || totalDistance < best.distance) {
      best = {
        hospital: typeof item === 'string' ? nodeMap.get(hospId) || { id: hospId } : item,
        route: {
          ...route,
          distance: totalDistance,
        },
        distance: totalDistance,
        etaMinutes: route.etaMinutes,
      };
    }
  }
  return best;
}

// حساب مسار المهمة الكاملة كما في تصميم Figma: (إسعاف -> موقع البلاغ -> المستشفى)
function planFullMission(ambulanceId, incidentIdOrCoords, hospitalId, graph = defaultGraph, options = {}) {
  let incidentNodeId = incidentIdOrCoords;
  let incidentCoords = null;
  if (typeof incidentIdOrCoords === 'object' && incidentIdOrCoords !== null) {
    const snap = findNearestNode(incidentIdOrCoords.lat, incidentIdOrCoords.lng, null, graph);
    if (!snap) return { found: false };
    incidentNodeId = snap.node.id;
    incidentCoords = [incidentIdOrCoords.lat, incidentIdOrCoords.lng];
  }

  const useAStar = options.algorithm === 'astar';
  const run = useAStar ? aStar : dijkstra;

  const toIncident = run(ambulanceId, incidentNodeId, graph, options);
  const toHospital = run(incidentNodeId, hospitalId, graph, options);

  if (!toIncident.found || !toHospital.found) {
    return { found: false, toIncident, toHospital };
  }

  const leg1Coords = incidentCoords ? [...toIncident.coordinates, incidentCoords] : toIncident.coordinates;
  const leg2Coords = incidentCoords ? [incidentCoords, ...toHospital.coordinates] : toHospital.coordinates.slice(1);
  const fullCoordinates = [...leg1Coords, ...leg2Coords];
  const totalDistance = Math.round((toIncident.distance + toHospital.distance) * 100) / 100;
  const totalEtaMinutes = Math.round((toIncident.etaMinutes + toHospital.etaMinutes) * 10) / 10;

  return {
    found: true,
    toIncident,
    toHospital,
    fullPath: [...toIncident.path, ...toHospital.path.slice(1)],
    fullCoordinates,
    totalDistance,
    totalEtaMinutes,
  };
}

// تجهيز بيانات الشبكة (العقد والوصلات بإحداثياتها) لرسم الخريطة في React-Leaflet مطابقة لتصميم Figma
function getMapGraphLayer(graph = defaultGraph) {
  const { nodeMap } = buildAdjacency(graph);
  const edges = (graph.edges || [])
    .map((e) => {
      const fromNode = nodeMap.get(e.from);
      const toNode = nodeMap.get(e.to);
      if (!fromNode || !toNode || typeof fromNode.lat !== 'number' || typeof toNode.lat !== 'number') return null;
      return {
        from: e.from,
        to: e.to,
        distance: e.distance,
        positions: [
          [fromNode.lat, fromNode.lng],
          [toNode.lat, toNode.lng],
        ],
      };
    })
    .filter(Boolean);

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

module.exports = {
  MinHeap,
  defaultGraph,
  haversineDistance,
  buildAdjacency,
  dijkstra,
  shortestPath: dijkstra,
  aStar,
  findNearestNode,
  routeByCoords,
  findNearestAmbulance,
  findNearestHospital,
  planFullMission,
  getMapGraphLayer,
};
