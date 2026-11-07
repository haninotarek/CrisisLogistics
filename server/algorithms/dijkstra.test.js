const test = require('node:test');
const assert = require('node:assert');
const {
  defaultGraph,
  dijkstra,
  aStar,
  findNearestNode,
  routeByCoords,
  findNearestAmbulance,
  findNearestHospital,
  planFullMission,
  getMapGraphLayer,
} = require('./dijkstra');

// جراف صغير للتحقق اليدوي الدقيق من اختيار الطريق الأقصر غير المباشر
const sampleGraph = {
  nodes: [
    { id: 'A1', name: 'إسعاف 1', type: 'ambulance', lat: 31.131, lng: 33.8, status: 'available' },
    { id: 'A2', name: 'إسعاف 2', type: 'ambulance', lat: 31.12, lng: 33.79, status: 'available' },
    { id: 'T1', name: 'تقاطع 1', type: 'intersection', lat: 31.132, lng: 33.802 },
    { id: 'P1', name: 'حادثة 1', type: 'intersection', lat: 31.13, lng: 33.805 },
    { id: 'H1', name: 'مستشفى العريش', type: 'hospital', lat: 31.1365, lng: 33.8089, status: 'free' },
    { id: 'ISOLATED', name: 'نقطة معزولة', type: 'intersection', lat: 29.0, lng: 30.0 },
  ],
  edges: [
    { from: 'A1', to: 'P1', distance: 4.5 },
    { from: 'A1', to: 'T1', distance: 1.2 },
    { from: 'T1', to: 'P1', distance: 0.7 },
    { from: 'A2', to: 'T1', distance: 2.3 },
    { from: 'P1', to: 'H1', distance: 1.4 },
  ],
};

test('default graph.json loads with valid hospitals, ambulances, and intersections', () => {
  assert.ok(Array.isArray(defaultGraph.nodes) && defaultGraph.nodes.length >= 100);
  assert.ok(Array.isArray(defaultGraph.edges) && defaultGraph.edges.length >= 300);

  const hospitals = defaultGraph.nodes.filter((n) => n.type === 'hospital');
  const ambulances = defaultGraph.nodes.filter((n) => n.type === 'ambulance');
  assert.ok(hospitals.length >= 30, 'should include hospitals across Egypt');
  assert.ok(ambulances.length >= 50, 'should include ambulance stations across Egypt');
});

test('dijkstra picks indirect shorter path (1.2 + 0.7 = 1.9 km) over direct longer edge (4.5 km)', () => {
  const res = dijkstra('A1', 'P1', sampleGraph);
  assert.strictEqual(res.found, true);
  assert.deepStrictEqual(res.path, ['A1', 'T1', 'P1']);
  assert.strictEqual(res.distance, 1.9);
  assert.strictEqual(res.coordinates.length, 3);
  assert.ok(res.etaMinutes > 0);
});

test('same start and end node returns zero distance immediately', () => {
  const res = dijkstra('A1', 'A1', sampleGraph);
  assert.strictEqual(res.found, true);
  assert.deepStrictEqual(res.path, ['A1']);
  assert.strictEqual(res.distance, 0);
  assert.strictEqual(res.etaMinutes, 0);
});

test('disconnected or unknown nodes return found = false cleanly', () => {
  const disconnected = dijkstra('A1', 'ISOLATED', sampleGraph);
  assert.strictEqual(disconnected.found, false);
  assert.strictEqual(disconnected.distance, Infinity);

  const unknown = dijkstra('DOES_NOT_EXIST', 'A1', sampleGraph);
  assert.strictEqual(unknown.found, false);
});

test('aStar finds the exact same optimal shortest distance as dijkstra on real Egypt network', () => {
  const pairs = [
    ['A_S00', 'H_S00'], // رمانة شمال سيناء
    ['A_S01', 'H_S01'], // العريش
    ['A_C01', 'H_C08'], // القصر العيني -> الشيخ زايد
    ['A_S01', 'H_C01'], // شمال سيناء -> القاهرة
  ];

  for (const [from, to] of pairs) {
    const dRes = dijkstra(from, to);
    const aRes = aStar(from, to);
    assert.strictEqual(dRes.found, true, `dijkstra should find route ${from} -> ${to}`);
    assert.strictEqual(aRes.found, true, `aStar should find route ${from} -> ${to}`);
    assert.strictEqual(aRes.distance, dRes.distance, `optimal distance must match for ${from} -> ${to}`);
    assert.ok(aRes.visitedCount <= dRes.visitedCount, 'aStar should explore <= nodes than dijkstra');
  }
});

test('GPS coordinates snap to local North Sinai station & hospital (Romana 31.014033, 32.662891)', () => {
  const gpsPoint = { lat: 31.014033, lng: 32.662891 };
  const nearestAmb = findNearestAmbulance(gpsPoint);
  const nearestHosp = findNearestHospital(gpsPoint);

  assert.ok(nearestAmb, 'must find an available ambulance');
  assert.strictEqual(nearestAmb.ambulance.id, 'A_S00');
  assert.ok(nearestAmb.distance < 5, `expected nearby ambulance (<5km), got ${nearestAmb.distance}km`);

  assert.ok(nearestHosp, 'must find a free hospital');
  assert.strictEqual(nearestHosp.hospital.id, 'H_S00');

  const gpsRoute = routeByCoords(gpsPoint.lat, gpsPoint.lng, nearestHosp.hospital.lat, nearestHosp.hospital.lng);
  assert.strictEqual(gpsRoute.found, true);
  assert.ok(gpsRoute.coordinates.length >= 2);
});

test('supports plain adjacency object format as fallback', () => {
  const legacyAdj = {
    S: { M: 2, E: 10 },
    M: { E: 3 },
    E: {},
  };
  const res = dijkstra('S', 'E', legacyAdj);
  assert.strictEqual(res.found, true);
  assert.deepStrictEqual(res.path, ['S', 'M', 'E']);
  assert.strictEqual(res.distance, 5);
});

test('planFullMission & getMapGraphLayer return full ambulance -> incident -> hospital coordinates for Figma map', () => {
  const mission = planFullMission('A_S00', { lat: 31.014033, lng: 32.662891 }, 'H_S00');
  assert.strictEqual(mission.found, true);
  assert.ok(mission.toIncident.distance > 0);
  assert.ok(mission.toHospital.distance > 0);
  assert.ok(mission.fullCoordinates.length >= 3);

  const layer = getMapGraphLayer();
  assert.strictEqual(layer.nodes.length, defaultGraph.nodes.length);
  assert.strictEqual(layer.edges.length, defaultGraph.edges.length);
});
