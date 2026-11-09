const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WAIT_REASON,
  etaMinutes,
  bedsNeededFor,
  selectAmbulance,
  selectHospital,
  decideForReport,
  planDispatch,
} = require('./dispatcher');

const distances = (map) => (entity) => (entity.node_id in map ? map[entity.node_id] : null);

const amb = (id, node_id, status = 'available') => ({ id, node_id, status });
const hosp = (id, node_id, available_beds, total_beds = 10) => ({ id, node_id, available_beds, total_beds });

test('ambulance: picks the nearest available one', () => {
  const d = distances({ N1: 5, N2: 1, N3: 3 });
  const best = selectAmbulance([amb(1, 'N1'), amb(2, 'N2', 'busy'), amb(3, 'N3')], d);
  assert.equal(best.ambulance.id, 3);
  assert.equal(best.distance, 3);
});

test('ambulance: ignores busy, offline and unreachable', () => {
  const d = distances({ N1: 1, N2: 2 });
  const list = [amb(1, 'N1', 'busy'), amb(2, 'N2', 'offline'), amb(3, 'N3')];
  assert.equal(selectAmbulance(list, d), null);
});

test('ambulance: equal distance -> smaller id wins', () => {
  const d = distances({ N1: 2, N2: 2 });
  assert.equal(selectAmbulance([amb(7, 'N1'), amb(4, 'N2')], d).ambulance.id, 4);
});

test('hospital: skips hospitals without enough beds', () => {
  const d = distances({ H1: 1, H2: 4 });
  const best = selectHospital([hosp(1, 'H1', 1), hosp(2, 'H2', 5)], d, { bedsNeeded: 2 });
  assert.equal(best.hospital.id, 2);
});

test('hospital: Critical goes strictly to the nearest', () => {
  const d = distances({ H1: 3, H2: 2 });
  const best = selectHospital([hosp(1, 'H1', 10), hosp(2, 'H2', 1)], d, { severity: 'Critical' });
  assert.equal(best.hospital.id, 2);
});

test('hospital: non-critical prefers a less crowded one when close', () => {
  const d = distances({ H1: 3, H2: 2 });
  const best = selectHospital([hosp(1, 'H1', 10), hosp(2, 'H2', 1)], d, { severity: 'Medium' });
  assert.equal(best.hospital.id, 1);
});

test('hospital: none with free beds -> null', () => {
  const d = distances({ H1: 1 });
  assert.equal(selectHospital([hosp(1, 'H1', 0)], d), null);
});

test('eta and beds helpers', () => {
  assert.equal(etaMinutes(30, 60), 30);
  assert.equal(etaMinutes(0.1, 60), 1);
  assert.equal(etaMinutes(null), null);
  assert.equal(bedsNeededFor({ injured_count: 3 }), 3);
  assert.equal(bedsNeededFor({}), 1);
  assert.equal(bedsNeededFor({ injured_count: 0 }), 1);
});

test('decision: waits with a reason when no ambulance / hospital', () => {
  const d = distances({ N1: 1, H1: 2 });
  const report = { id: 1, severity: 'Critical', injured_count: 1 };

  assert.deepEqual(decideForReport(report, [amb(1, 'N1', 'busy')], [hosp(1, 'H1', 5)], d),
    { status: 'waiting', reason: WAIT_REASON.NO_AMBULANCE });
  assert.deepEqual(decideForReport(report, [amb(1, 'NX')], [hosp(1, 'H1', 5)], d),
    { status: 'waiting', reason: WAIT_REASON.NO_REACHABLE_AMBULANCE });
  assert.deepEqual(decideForReport(report, [amb(1, 'N1')], [hosp(1, 'H1', 0)], d),
    { status: 'waiting', reason: WAIT_REASON.NO_HOSPITAL });
  assert.deepEqual(decideForReport(report, [amb(1, 'N1')], [hosp(1, 'HX', 5)], d),
    { status: 'waiting', reason: WAIT_REASON.NO_REACHABLE_HOSPITAL });
});

test('decision: returns distances and ETA when assigned', () => {
  const d = distances({ N1: 3, H1: 6 });
  const r = decideForReport({ id: 1, severity: 'Low' }, [amb(1, 'N1')], [hosp(1, 'H1', 5)], d, { speedKmh: 60 });
  assert.equal(r.status, 'assigned');
  assert.equal(r.ambulance_distance_km, 3);
  assert.equal(r.hospital_distance_km, 6);
  assert.equal(r.total_distance_km, 9);
  assert.equal(r.eta_to_patient_minutes, 3);
  assert.equal(r.total_eta_minutes, 9);
});

test('plan: follows queue order, marks ambulances busy, keeps the rest waiting', () => {
  const d = distances({ N1: 1, N2: 2, H1: 3, H2: 4 });
  const queue = [
    { id: 'A', severity: 'Critical', injured_count: 1, status: 'waiting' },
    { id: 'B', severity: 'Medium', injured_count: 1, status: 'waiting' },
    { id: 'C', severity: 'Low', injured_count: 1, status: 'waiting' },
  ];
  const ambulances = [amb(1, 'N1'), amb(2, 'N2')];
  const hospitals = [hosp(1, 'H1', 5), hosp(2, 'H2', 5)];

  const plan = planDispatch(queue, ambulances, hospitals, () => d);

  assert.deepEqual(plan.assignments.map((a) => [a.report.id, a.ambulance.id]), [['A', 1], ['B', 2]]);
  assert.equal(plan.assignments[0].report.status, 'assigned');
  assert.equal(plan.assignments[0].ambulance.status, 'busy');

  assert.deepEqual(plan.waiting.map((w) => [w.report.id, w.reason]), [['C', WAIT_REASON.NO_AMBULANCE]]);

  assert.deepEqual(plan.ambulances.map((a) => a.status), ['busy', 'busy']);
  assert.equal(plan.hospitals.reduce((s, h) => s + h.available_beds, 0), 8);

  assert.deepEqual(ambulances.map((a) => a.status), ['available', 'available']);
  assert.equal(hospitals[0].available_beds, 5);
});

test('plan: beds are reserved across reports in the same round', () => {
  const d = distances({ N1: 1, N2: 1, H1: 1 });
  const queue = [
    { id: 1, severity: 'Critical', injured_count: 2 },
    { id: 2, severity: 'Critical', injured_count: 1 },
  ];
  const plan = planDispatch(queue, [amb(1, 'N1'), amb(2, 'N2')], [hosp(1, 'H1', 2)], () => d);
  assert.equal(plan.assignments.length, 1);
  assert.equal(plan.assignments[0].beds_needed, 2);
  assert.equal(plan.hospitals[0].available_beds, 0);
  assert.equal(plan.waiting[0].reason, WAIT_REASON.NO_HOSPITAL);
  assert.equal(plan.ambulances[1].status, 'available');
});

test('plan: max limits how many reports get dispatched', () => {
  const d = distances({ N1: 1, N2: 1, H1: 1 });
  const queue = [{ id: 1 }, { id: 2 }];
  const plan = planDispatch(queue, [amb(1, 'N1'), amb(2, 'N2')], [hosp(1, 'H1', 10)], () => d, { max: 1 });
  assert.equal(plan.assignments.length, 1);
  assert.equal(plan.waiting.length, 1);
});

test('plan: each report uses its own distances', () => {
  const byReport = {
    1: distances({ N1: 1, N2: 9, H1: 1 }),
    2: distances({ N1: 9, N2: 1, H1: 1 }),
  };
  const queue = [{ id: 2 }, { id: 1 }];
  const plan = planDispatch(queue, [amb(1, 'N1'), amb(2, 'N2')], [hosp(1, 'H1', 10)], (r) => byReport[r.id]);
  assert.deepEqual(plan.assignments.map((a) => [a.report.id, a.ambulance.id]), [[2, 2], [1, 1]]);
});

test('plan: skips reports that are not waiting', () => {
  const d = distances({ N1: 1, H1: 1 });
  const plan = planDispatch([{ id: 1, status: 'done' }], [amb(1, 'N1')], [hosp(1, 'H1', 1)], () => d);
  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.waiting.length, 0);
});
