const { sortReports } = require('./priorityQueue');
const { dijkstra, defaultGraph } = require('./dijkstra');
const { planDispatch } = require('./dispatcher');

const node = (id) => defaultGraph.nodes.find((n) => n.id === id);
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const ambulances = [
  { id: 1, name: node('A_S00').name, node_id: 'A_S00', status: 'available' },
  { id: 2, name: node('A_S11').name, node_id: 'A_S11', status: 'available' },
  { id: 3, name: node('A_S01').name, node_id: 'A_S01', status: 'offline' },
];
const hospitals = [
  { id: 1, name: node('H_S00').name, node_id: 'H_S00', total_beds: 65, available_beds: 2 },
  { id: 2, name: node('H_S07').name, node_id: 'H_S07', total_beds: 45, available_beds: 20 },
];
const reports = [
  { id: 101, severity: 'Low', injured_count: 1, node_id: 'J_SIN_03', status: 'waiting', created_at: minutesAgo(15) },
  { id: 102, severity: 'Critical', injured_count: 3, node_id: 'J_SIN_04', status: 'waiting', created_at: minutesAgo(1) },
  { id: 103, severity: 'Medium', injured_count: 2, node_id: 'J_SIN_05', status: 'waiting', created_at: minutesAgo(5) },
];

const queue = sortReports(reports);
console.log('Queue order:', queue.map((r) => `#${r.id} ${r.severity} (score ${r.score})`).join('  >  '));

const distanceFor = (report) => (entity) => {
  const route = dijkstra(report.node_id, entity.node_id, defaultGraph);
  return route.found ? route.distance : null;
};

const plan = planDispatch(queue, ambulances, hospitals, distanceFor, { speedKmh: 60 });

console.log('\nAssigned:');
console.table(plan.assignments.map((a) => ({
  report: a.report.id,
  severity: a.report.severity,
  ambulance: `${a.ambulance.id} · ${a.ambulance.name}`,
  hospital: `${a.hospital.id} · ${a.hospital.name}`,
  'to patient (km)': a.ambulance_distance_km,
  'to hospital (km)': a.hospital_distance_km,
  'ETA (min)': a.total_eta_minutes,
})));

console.log('Still waiting:');
console.table(plan.waiting.map((w) => ({ report: w.report.id, severity: w.report.severity, reason: w.reason })));

console.log('Ambulances after:', plan.ambulances.map((a) => `${a.id}:${a.status}`).join(', '));
console.log('Hospital beds after:', plan.hospitals.map((h) => `${h.id}:${h.available_beds}/${h.total_beds}`).join(', '));
