import graphData from "../data/graph.json";

const AVG_SPEED_KMH = 40;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const nodeMap = new Map();
for (const n of graphData.nodes) {
  nodeMap.set(n.id, {
    node_id: n.id,
    id: n.id,
    name: n.name,
    type: n.type,
    latitude: n.lat,
    longitude: n.lng,
    lat: n.lat,
    lng: n.lng,
  });
}

const adj = new Map();
for (const n of graphData.nodes) adj.set(n.id, []);
for (const e of graphData.edges) {
  const d = Number(e.distance ?? e.weight ?? 1);
  if (adj.has(e.from) && adj.has(e.to)) {
    adj.get(e.from).push({ to: e.to, weight: d });
    if (e.bidirectional !== false) {
      adj.get(e.to).push({ to: e.from, weight: d });
    }
  }
}

export function findNearestNodeId(lat, lng) {
  let bestId = null;
  let bestDist = Infinity;
  for (const n of nodeMap.values()) {
    const d = haversineKm(lat, lng, n.latitude, n.longitude);
    if (d < bestDist) {
      bestDist = d;
      bestId = n.node_id;
    }
  }
  return bestId;
}

export function runDijkstra(startId, endId) {
  if (!adj.has(startId) || !adj.has(endId)) return null;
  if (startId === endId) {
    const n = nodeMap.get(startId);
    return {
      distance_km: 0.2,
      approximate: false,
      path: [startId],
      coordinates: [[n.latitude, n.longitude]],
      eta_minutes: 1,
    };
  }
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const id of adj.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);

  const pq = [{ id: startId, d: 0 }];
  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift();
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    if (cur.id === endId) break;
    for (const edge of adj.get(cur.id) || []) {
      if (visited.has(edge.to)) continue;
      const nd = cur.d + edge.weight;
      if (nd < dist.get(edge.to)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, cur.id);
        pq.push({ id: edge.to, d: nd });
      }
    }
  }

  const totalDist = dist.get(endId);
  if (!Number.isFinite(totalDist)) return null;
  const path = [];
  let u = endId;
  while (u) {
    path.unshift(u);
    u = prev.get(u);
  }
  const coordinates = path.map((id) => {
    const n = nodeMap.get(id);
    return [n.latitude, n.longitude];
  });
  const km = Math.round(totalDist * 100) / 100;
  return {
    distance_km: km,
    approximate: false,
    path,
    coordinates,
    eta_minutes: Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60)),
  };
}

// Exact Hospital & Ambulance seeds from server/db/seed.sql
const HOSPITAL_SEEDS = [
  ["H_S00", "مستشفى رمانة المركزي للطوارئ", 65, 32],
  ["H_S07", "مركز طوارئ رابعة الطبي", 45, 22],
  ["H_S08", "مستشفى القنطرة شرق المركزي", 90, 45],
  ["H_D08", "مجمع الإسماعيلية الطبي", 260, 130],
  ["H_D09", "مستشفى السلام بورسعيد", 220, 109],
  ["H_D10", "مستشفى الحياة بورفؤاد", 160, 80],
  ["H_S01", "مستشفى العريش العام", 120, 60],
  ["H_S02", "مستشفى بئر العبد المركزي", 80, 40],
  ["H_S03", "مستشفى الشيخ زويد المركزي", 60, 30],
  ["H_S04", "مستشفى نخل المركزي", 40, 20],
  ["H_S05", "مستشفى الحسنة المركزي", 35, 17],
  ["H_S06", "مستشفى الطور العام", 90, 45],
  ["H_C01", "مستشفى القصر العيني", 320, 160],
  ["H_C02", "مستشفى عين شمس التخصصي", 280, 140],
  ["H_C03", "مستشفى الدمرداش", 200, 0],
  ["H_C04", "مستشفى معهد ناصر", 260, 130],
  ["H_C05", "مستشفى دار الشفاء", 180, 90],
  ["H_C06", "مستشفى الهلال", 150, 75],
  ["H_C07", "مستشفى أم المصريين", 220, 110],
  ["H_C08", "مستشفى الشيخ زايد التخصصي", 190, 95],
  ["H_C09", "مستشفى 6 أكتوبر المركزي", 160, 80],
  ["H_C10", "مستشفى حلوان العام", 140, 70],
  ["H_A01", "مستشفى الشاطبي الجامعي", 240, 120],
  ["H_A02", "مستشفى جامعة الإسكندرية", 300, 150],
  ["H_A03", "مستشفى العامرية العام", 180, 90],
  ["H_A04", "مستشفى برج العرب", 120, 60],
  ["H_D01", "مستشفى المنصورة الجامعي", 280, 140],
  ["H_D02", "مستشفى المنصورة الدولي", 200, 100],
  ["H_D03", "مستشفى الزقازيق الجامعي", 260, 130],
  ["H_D04", "مستشفى طنطا الجامعي", 250, 125],
  ["H_D05", "مستشفى دمنهور العام", 190, 95],
  ["H_D06", "مستشفى شبين الكوم", 170, 85],
  ["H_D07", "مستشفى بنها الجامعي", 210, 105],
  ["H_P01", "مستشفى أسيوط الجامعي", 290, 145],
  ["H_P02", "مستشفى المنيا العام", 200, 100],
  ["H_P03", "مستشفى سوهاج الجامعي", 240, 120],
  ["H_P04", "مستشفى قنا العام", 180, 90],
  ["H_P05", "مستشفى أسوان الجامعي", 210, 105],
];

const AMBULANCE_SEEDS = [
  ["A_S00", "إسعاف رمانة - الطريق الدولي", "available"],
  ["A_S11", "إسعاف رابعة وبالوظة", "available"],
  ["A_S12", "إسعاف القنطرة شرق", "available"],
  ["A_S01", "إسعاف العريش - الميدان", "available"],
  ["A_S02", "إسعاف العريش - البحر", "available"],
  ["A_S03", "إسعاف المساعيد", "available"],
  ["A_S04", "إسعاف العبور", "busy"],
  ["A_S05", "إسعاف بئر العبد", "available"],
  ["A_S06", "إسعاف الشيخ زويد", "available"],
  ["A_S07", "إسعاف نخل", "available"],
  ["A_S08", "إسعاف الحسنة", "available"],
  ["A_S09", "إسعاف الطور - شرم", "available"],
  ["A_S10", "إسعاف نويبع", "available"],
  ["A_C01", "إسعاف القصر العيني 1", "available"],
  ["A_C02", "إسعاف القصر العيني 2", "available"],
  ["A_C03", "إسعاف عين شمس", "available"],
  ["A_C04", "إسعاف الدمرداش", "busy"],
  ["A_C05", "إسعاف معهد ناصر", "available"],
  ["A_C06", "إسعاف رمسيس", "available"],
  ["A_C07", "إسعاف الجيزة", "available"],
  ["A_C08", "إسعاف المهندسين", "available"],
  ["A_C09", "إسعاف الشيخ زايد", "available"],
  ["A_C10", "إسعاف 6 أكتوبر", "available"],
  ["A_C11", "إسعاف المعادي", "available"],
  ["A_C12", "إسعاف مدينة نصر", "available"],
  ["A_C13", "إسعاف حلوان", "available"],
  ["A_C14", "إسعاف شبرا", "busy"],
  ["A_C15", "إسعاف مصر الجديدة", "available"],
  ["A_C16", "إسعاف التجمع الخامس", "available"],
  ["A_A01", "إسعاف الشاطبي", "available"],
  ["A_A02", "إسعاف سموحة", "available"],
  ["A_A03", "إسعاف العامرية", "available"],
  ["A_A04", "إسعاف برج العرب", "available"],
  ["A_A05", "إسعاف المنتزه", "available"],
  ["A_A06", "إسعاف العجمي", "busy"],
  ["A_D01", "إسعاف المنصورة 1", "available"],
  ["A_D02", "إسعاف المنصورة 2", "available"],
  ["A_D03", "إسعاف الزقازيق 1", "available"],
  ["A_D04", "إسعاف الزقازيق 2", "busy"],
  ["A_D05", "إسعاف طنطا 1", "available"],
  ["A_D06", "إسعاف طنطا 2", "available"],
  ["A_D07", "إسعاف دمنهور", "available"],
  ["A_D08", "إسعاف كفر الشيخ", "available"],
  ["A_D09", "إسعاف شبين الكوم", "available"],
  ["A_D10", "إسعاف بنها 1", "available"],
  ["A_D11", "إسعاف بنها 2", "available"],
  ["A_D12", "إسعاف دمياط", "available"],
  ["A_D13", "إسعاف بورسعيد", "busy"],
  ["A_D14", "إسعاف الإسماعيلية", "available"],
  ["A_P01", "إسعاف أسيوط 1", "available"],
  ["A_P02", "إسعاف أسيوط 2", "available"],
  ["A_P03", "إسعاف المنيا 1", "available"],
  ["A_P04", "إسعاف المنيا 2", "busy"],
  ["A_P05", "إسعاف سوهاج 1", "available"],
  ["A_P06", "إسعاف سوهاج 2", "available"],
  ["A_P07", "إسعاف قنا", "available"],
  ["A_P08", "إسعاف الأقصر", "available"],
  ["A_P09", "إسعاف أسوان 1", "available"],
  ["A_P10", "إسعاف أسوان 2", "available"],
  ["A_P11", "إسعاف الفيوم", "available"],
  ["A_P12", "إسعاف بني سويف", "available"],
];

let hospitals = HOSPITAL_SEEDS.map(([node_id, name, total_beds, available_beds], idx) => {
  const n = nodeMap.get(node_id) || { latitude: 30.05, longitude: 31.23 };
  return {
    id: idx + 1,
    node_id,
    name,
    latitude: n.latitude,
    longitude: n.longitude,
    total_beds,
    available_beds,
  };
});

let ambulances = AMBULANCE_SEEDS.map(([node_id, name, status], idx) => {
  const n = nodeMap.get(node_id) || { latitude: 30.05, longitude: 31.23 };
  return {
    id: idx + 1,
    node_id,
    name,
    latitude: n.latitude,
    longitude: n.longitude,
    status,
  };
});

const findAmbId = (nodeId) => ambulances.find((a) => a.node_id === nodeId)?.id || null;
const findHospId = (nodeId) => hospitals.find((h) => h.node_id === nodeId)?.id || null;

const now = Date.now();
let reports = [
  {
    id: 1,
    incident_code: "INC-001",
    latitude: 31.235,
    longitude: 32.295,
    node_id: "J_CAN_02",
    patient_name: "أحمد محمود",
    age: 35,
    injury_type: "حادث سيارة",
    injured_count: 1,
    conscious: false,
    bleeding: "severe",
    breathing_issue: true,
    pain_level: 9,
    severity: "Critical",
    reporter_name: "سامي حسن",
    reporter_phone: "01012345678",
    priority_score: 95,
    status: "assigned",
    ambulance_id: findAmbId("A_D13"),
    hospital_id: findHospId("H_D09"),
    created_at: new Date(now - 14 * 60000).toISOString(),
    assigned_at: new Date(now - 10 * 60000).toISOString(),
    completed_at: null,
  },
  {
    id: 2,
    incident_code: "INC-001",
    latitude: 31.235,
    longitude: 32.295,
    node_id: "J_CAN_02",
    patient_name: "منى سعيد",
    age: 29,
    injury_type: "حادث سيارة",
    injured_count: 1,
    conscious: true,
    bleeding: "moderate",
    breathing_issue: false,
    pain_level: 6,
    severity: "Medium",
    reporter_name: "سامي حسن",
    reporter_phone: "01012345678",
    priority_score: 55,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 13 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 3,
    incident_code: "INC-001",
    latitude: 31.235,
    longitude: 32.295,
    node_id: "J_CAN_02",
    patient_name: "يوسف سامي",
    age: 8,
    injury_type: "حادث سيارة",
    injured_count: 1,
    conscious: true,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 3,
    severity: "Low",
    reporter_name: "سامي حسن",
    reporter_phone: "01012345678",
    priority_score: 20,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 12 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 4,
    incident_code: "INC-002",
    latitude: 31.132,
    longitude: 33.803,
    node_id: "J_SIN_01",
    patient_name: "محمود سالم",
    age: 42,
    injury_type: "حادث سيارة",
    injured_count: 2,
    conscious: false,
    bleeding: "severe",
    breathing_issue: true,
    pain_level: 9,
    severity: "Critical",
    reporter_name: "خالد سويلم",
    reporter_phone: "01022334455",
    priority_score: 98,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 9 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 5,
    incident_code: "INC-003",
    latitude: 31.244,
    longitude: 32.3203,
    node_id: "J_CAN_02",
    patient_name: "محمد إبراهيم",
    age: 62,
    injury_type: "ألم في الصدر",
    injured_count: 1,
    conscious: true,
    bleeding: "none",
    breathing_issue: true,
    pain_level: 8,
    severity: "Critical",
    reporter_name: "كريم إبراهيم",
    reporter_phone: "01234567890",
    priority_score: 90,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 8 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 6,
    incident_code: "INC-004",
    latitude: 31.014,
    longitude: 32.6629,
    node_id: "J_SIN_05",
    patient_name: "سارة علي",
    age: 24,
    injury_type: "كسر في الذراع",
    injured_count: 1,
    conscious: true,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 7,
    severity: "Medium",
    reporter_name: "نادية علي",
    reporter_phone: "01123456789",
    priority_score: 50,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 7 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 7,
    incident_code: "INC-005",
    latitude: 30.0444,
    longitude: 31.2357,
    node_id: "J_CAI_01",
    patient_name: "آدم رضا",
    age: 5,
    injury_type: "سقوط من ارتفاع",
    injured_count: 1,
    conscious: false,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 8,
    severity: "Critical",
    reporter_name: "رضا فؤاد",
    reporter_phone: "01155554444",
    priority_score: 92,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 6 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 8,
    incident_code: "INC-006",
    latitude: 30.5965,
    longitude: 32.2715,
    node_id: "J_CAN_01",
    patient_name: "عمر خالد",
    age: 19,
    injury_type: "كدمات بسيطة",
    injured_count: 1,
    conscious: true,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 2,
    severity: "Low",
    reporter_name: "خالد حسن",
    reporter_phone: "01066667777",
    priority_score: 15,
    status: "done",
    ambulance_id: findAmbId("A_D14"),
    hospital_id: findHospId("H_D08"),
    created_at: new Date(now - 120 * 60000).toISOString(),
    assigned_at: new Date(now - 115 * 60000).toISOString(),
    completed_at: new Date(now - 60 * 60000).toISOString(),
  },
  {
    id: 9,
    incident_code: "INC-007",
    latitude: 30.066,
    longitude: 31.285,
    node_id: "J_CAI_03",
    patient_name: "فاطمة نبيل",
    age: 70,
    injury_type: "إغماء",
    injured_count: 1,
    conscious: false,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 4,
    severity: "Medium",
    reporter_name: "ليلى نبيل",
    reporter_phone: "01177778888",
    priority_score: 60,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 5 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
  {
    id: 10,
    incident_code: "INC-008",
    latitude: 30.062,
    longitude: 31.2465,
    node_id: "J_CAI_02",
    patient_name: "حسن عادل",
    age: 33,
    injury_type: "حروق",
    injured_count: 1,
    conscious: true,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 8,
    severity: "Medium",
    reporter_name: "طارق سمير",
    reporter_phone: "01299990000",
    priority_score: 58,
    status: "waiting",
    ambulance_id: null,
    hospital_id: null,
    created_at: new Date(now - 4 * 60000).toISOString(),
    assigned_at: null,
    completed_at: null,
  },
];

let nextReportId = 11;
let nextAmbId = ambulances.length + 1;
let nextHospId = hospitals.length + 1;

function enrichReport(r) {
  const amb = r.ambulance_id ? ambulances.find((a) => a.id === r.ambulance_id) : null;
  const hosp = r.hospital_id ? hospitals.find((h) => h.id === r.hospital_id) : null;
  return {
    ...r,
    ambulance_name: amb ? amb.name : null,
    hospital_name: hosp ? hosp.name : null,
  };
}

function ruleBasedSeverity(c) {
  if (!c.conscious || c.breathing_issue || c.bleeding === "severe" || (c.pain_level ?? 0) >= 9) {
    return "Critical";
  }
  if (
    c.bleeding === "moderate" ||
    (c.pain_level ?? 0) >= 5 ||
    (c.injured_count ?? 1) >= 3 ||
    (c.age !== null && c.age !== undefined && (c.age >= 65 || c.age < 5))
  ) {
    return "Medium";
  }
  return "Low";
}

function computePriorityScore(c, severity) {
  const base = { Critical: 70, Medium: 40, Low: 10 }[severity] ?? 10;
  let score = base;
  if (!c.conscious) score += 10;
  if (c.breathing_issue) score += 10;
  score += { severe: 8, moderate: 4, mild: 1 }[c.bleeding] ?? 0;
  score += Math.round((c.pain_level ?? 0) / 2);
  score += Math.min(15, (Math.max(1, c.injured_count ?? 1) - 1) * 3);
  if (c.age !== null && c.age !== undefined && (c.age < 12 || c.age >= 65)) score += 5;
  return Math.max(0, Math.min(100, score));
}

function sortQueueByPriority(waitingList) {
  const tierMap = { Critical: 3, Medium: 2, Low: 1 };
  return [...waitingList].sort((a, b) => {
    const tierDiff = (tierMap[b.severity] || 1) - (tierMap[a.severity] || 1);
    if (tierDiff !== 0) return tierDiff;
    const ageA = Math.min(20, Math.floor((Date.now() - new Date(a.created_at).getTime()) / 120000));
    const ageB = Math.min(20, Math.floor((Date.now() - new Date(b.created_at).getTime()) / 120000));
    const effDiff = (b.priority_score + ageB) - (a.priority_score + ageA);
    if (effDiff !== 0) return effDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function buildRouteForReport(report, amb, hosp) {
  const pNode = report.node_id || findNearestNodeId(report.latitude, report.longitude);
  let toPatient = null;
  if (amb) {
    const aNode = amb.node_id || findNearestNodeId(amb.latitude, amb.longitude);
    const leg = runDijkstra(aNode, pNode);
    if (leg) {
      const coords = [[amb.latitude, amb.longitude], ...leg.coordinates, [report.latitude, report.longitude]];
      toPatient = { ...leg, coordinates: coords };
    }
  }
  let toHospital = null;
  if (hosp) {
    const hNode = hosp.node_id || findNearestNodeId(hosp.latitude, hosp.longitude);
    const leg = runDijkstra(pNode, hNode);
    if (leg) {
      const coords = [[report.latitude, report.longitude], ...leg.coordinates, [hosp.latitude, hosp.longitude]];
      toHospital = { ...leg, coordinates: coords };
    }
  }
  const totalKm = Math.round(((toPatient?.distance_km ?? 0) + (toHospital?.distance_km ?? 0)) * 100) / 100;
  return {
    ambulance_to_patient: toPatient,
    patient_to_hospital: toHospital,
    total_distance_km: totalKm,
    total_eta_minutes: Math.max(1, Math.round((totalKm / AVG_SPEED_KMH) * 60)),
  };
}

export const mockBackend = {
  getStats() {
    const waiting = reports.filter((r) => r.status === "waiting");
    const assigned = reports.filter((r) => r.status === "assigned");
    const done = reports.filter((r) => r.status === "done");
    return {
      success: true,
      data: {
        reports_waiting: waiting.length,
        reports_assigned: assigned.length,
        reports_done: done.length,
        critical_waiting: waiting.filter((r) => r.severity === "Critical").length,
        ambulances_available: ambulances.filter((a) => a.status === "available").length,
        ambulances_busy: ambulances.filter((a) => a.status === "busy").length,
        ambulances_offline: ambulances.filter((a) => a.status === "offline").length,
        beds_available: hospitals.reduce((s, h) => s + h.available_beds, 0),
        beds_total: hospitals.reduce((s, h) => s + h.total_beds, 0),
        avg_wait_minutes: 4.2,
      },
    };
  },

  getReports(params = {}) {
    let list = reports.map(enrichReport);
    if (params.status) list = list.filter((r) => r.status === params.status);
    if (params.severity) list = list.filter((r) => r.severity === params.severity);
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { success: true, count: list.length, total: list.length, data: list };
  },

  getQueue() {
    const waiting = reports.filter((r) => r.status === "waiting").map(enrichReport);
    const sorted = sortQueueByPriority(waiting);
    return { success: true, count: sorted.length, data: sorted };
  },

  createReport(payload, autoDispatch = false) {
    const node_id = payload.node_id || findNearestNodeId(Number(payload.latitude), Number(payload.longitude));
    const severity = payload.severity || ruleBasedSeverity(payload);
    const priority_score = computePriorityScore(payload, severity);
    const newRep = {
      id: nextReportId++,
      incident_code: `INC-${String(nextReportId - 1).padStart(3, "0")}`,
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      node_id,
      patient_name: payload.patient_name || "مصاب بدون اسم",
      age: payload.age !== "" && payload.age !== null && payload.age !== undefined ? Number(payload.age) : null,
      injury_type: payload.injury_type,
      injured_count: Number(payload.injured_count || 1),
      conscious: Boolean(payload.conscious),
      bleeding: payload.bleeding || "none",
      breathing_issue: Boolean(payload.breathing_issue),
      pain_level: payload.pain_level !== null && payload.pain_level !== undefined ? Number(payload.pain_level) : 5,
      severity,
      reporter_name: payload.reporter_name || null,
      reporter_phone: payload.reporter_phone || null,
      priority_score,
      status: "waiting",
      ambulance_id: null,
      hospital_id: null,
      created_at: new Date().toISOString(),
      assigned_at: null,
      completed_at: null,
    };
    reports.unshift(newRep);

    const response = {
      success: true,
      triage_source: payload.severity ? "manual" : "ai",
      data: enrichReport(newRep),
    };

    if (autoDispatch) {
      try {
        const dispatchRes = this.assignReport(newRep.id);
        response.dispatch = dispatchRes.data;
        response.data = dispatchRes.data.report;
      } catch (err) {
        response.dispatch_error = err.message;
      }
    }
    return response;
  },

  assignReport(id) {
    const rep = reports.find((r) => r.id === Number(id));
    if (!rep) throw new Error("البلاغ غير موجود");
    if (rep.status !== "waiting") throw new Error("هذا البلاغ تم توجيهه بالفعل");

    const availAmbs = ambulances.filter((a) => a.status === "available");
    if (availAmbs.length === 0) throw new Error("لا توجد سيارة إسعاف متاحة حالياً");

    const bedsNeeded = rep.injured_count || 1;
    const availHosps = hospitals.filter((h) => h.available_beds >= bedsNeeded);
    if (availHosps.length === 0) throw new Error(`لا يوجد مستشفى به ${bedsNeeded} سرير متاح حالياً`);

    const pNode = rep.node_id || findNearestNodeId(rep.latitude, rep.longitude);

    let bestAmb = null;
    let bestAmbDist = Infinity;
    for (const a of availAmbs) {
      const r = runDijkstra(a.node_id || findNearestNodeId(a.latitude, a.longitude), pNode);
      const d = r ? r.distance_km : haversineKm(a.latitude, a.longitude, rep.latitude, rep.longitude) * 1.35;
      if (d < bestAmbDist) {
        bestAmbDist = d;
        bestAmb = a;
      }
    }

    let bestHosp = null;
    let bestHospScore = Infinity;
    for (const h of availHosps) {
      const r = runDijkstra(pNode, h.node_id || findNearestNodeId(h.latitude, h.longitude));
      const d = r ? r.distance_km : haversineKm(rep.latitude, rep.longitude, h.latitude, h.longitude) * 1.35;
      const crowdingPenalty = rep.severity === "Critical" ? 0 : (1 - h.available_beds / Math.max(1, h.total_beds)) * 2;
      const score = d + crowdingPenalty;
      if (score < bestHospScore) {
        bestHospScore = score;
        bestHosp = h;
      }
    }

    bestAmb.status = "busy";
    bestHosp.available_beds = Math.max(0, bestHosp.available_beds - bedsNeeded);
    rep.status = "assigned";
    rep.ambulance_id = bestAmb.id;
    rep.hospital_id = bestHosp.id;
    rep.assigned_at = new Date().toISOString();

    const route = buildRouteForReport(rep, bestAmb, bestHosp);
    return {
      success: true,
      data: {
        report: enrichReport(rep),
        ambulance: bestAmb,
        hospital: bestHosp,
        route,
      },
    };
  },

  completeReport(id) {
    const rep = reports.find((r) => r.id === Number(id));
    if (!rep) throw new Error("البلاغ غير موجود");
    const amb = ambulances.find((a) => a.id === rep.ambulance_id);
    const hosp = hospitals.find((h) => h.id === rep.hospital_id);
    if (amb) {
      amb.status = "available";
      if (hosp) {
        amb.latitude = hosp.latitude;
        amb.longitude = hosp.longitude;
        amb.node_id = hosp.node_id;
      }
    }
    rep.status = "done";
    rep.completed_at = new Date().toISOString();
    return { success: true, data: enrichReport(rep) };
  },

  unassignReport(id) {
    const rep = reports.find((r) => r.id === Number(id));
    if (!rep) throw new Error("البلاغ غير موجود");
    const amb = ambulances.find((a) => a.id === rep.ambulance_id);
    const hosp = hospitals.find((h) => h.id === rep.hospital_id);
    if (amb) amb.status = "available";
    if (hosp) hosp.available_beds = Math.min(hosp.total_beds, hosp.available_beds + (rep.injured_count || 1));
    rep.status = "waiting";
    rep.ambulance_id = null;
    rep.hospital_id = null;
    rep.assigned_at = null;
    return { success: true, data: enrichReport(rep) };
  },

  deleteReport(id) {
    const idx = reports.findIndex((r) => r.id === Number(id));
    if (idx === -1) throw new Error("البلاغ غير موجود");
    if (reports[idx].status === "assigned") {
      throw new Error("لا يمكن حذف بلاغ قيد التنفيذ — قم بإلغاء التخصيص أو إنهائه أولاً");
    }
    reports.splice(idx, 1);
    return { success: true, message: "تم حذف البلاغ" };
  },

  getReportRoute(id) {
    const rep = reports.find((r) => r.id === Number(id));
    if (!rep) throw new Error("البلاغ غير موجود");
    const amb = rep.ambulance_id ? ambulances.find((a) => a.id === rep.ambulance_id) : null;
    const hosp = rep.hospital_id ? hospitals.find((h) => h.id === rep.hospital_id) : null;
    if (!amb && !hosp) throw new Error("لم يتم تخصيص إسعاف أو مستشفى لهذا البلاغ بعد");
    return { success: true, data: buildRouteForReport(rep, rep.status === "assigned" ? amb : null, hosp) };
  },

  dispatchNext() {
    const q = this.getQueue().data;
    if (q.length === 0) return { success: true, data: { assigned: [], skipped: [], remaining_in_queue: 0 } };
    const assigned = [];
    const skipped = [];
    try {
      const res = this.assignReport(q[0].id);
      assigned.push(res.data);
    } catch (err) {
      skipped.push({ report_id: q[0].id, reason: err.message });
    }
    return {
      success: true,
      data: {
        assigned,
        skipped,
        remaining_in_queue: reports.filter((r) => r.status === "waiting").length,
      },
    };
  },

  dispatchAll() {
    const q = this.getQueue().data;
    const assigned = [];
    const skipped = [];
    for (const item of q) {
      try {
        const res = this.assignReport(item.id);
        assigned.push(res.data);
      } catch (err) {
        skipped.push({ report_id: item.id, reason: err.message });
      }
    }
    return {
      success: true,
      data: {
        assigned,
        skipped,
        remaining_in_queue: reports.filter((r) => r.status === "waiting").length,
      },
    };
  },

  getAmbulances(status = "") {
    let list = ambulances.map((a) => {
      const active = reports.find((r) => r.ambulance_id === a.id && r.status === "assigned");
      return { ...a, active_report_id: active ? active.id : null };
    });
    if (status) list = list.filter((a) => a.status === status);
    return { success: true, count: list.length, data: list };
  },

  createAmbulance(payload) {
    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);
    const node_id = payload.node_id || findNearestNodeId(lat, lng);
    const created = {
      id: nextAmbId++,
      name: payload.name,
      latitude: lat,
      longitude: lng,
      node_id,
      status: payload.status || "available",
    };
    ambulances.unshift(created);
    return { success: true, data: created };
  },

  updateAmbulanceStatus(id, status) {
    const amb = ambulances.find((a) => a.id === Number(id));
    if (!amb) throw new Error("وحدة الإسعاف غير موجودة");
    const active = reports.find((r) => r.ambulance_id === amb.id && r.status === "assigned");
    if (active) throw new Error(`الإسعاف مخصص حالياً للبلاغ #${active.id} — أنهِ المهمة أولاً`);
    if (status === "busy") throw new Error("حالة 'مشغولة' تتحدد تلقائياً عند التوجيه");
    amb.status = status;
    return { success: true, data: amb };
  },

  deleteAmbulance(id) {
    const amb = ambulances.find((a) => a.id === Number(id));
    if (!amb) throw new Error("وحدة الإسعاف غير موجودة");
    const used = reports.some((r) => r.ambulance_id === amb.id);
    if (used) throw new Error("الإسعاف مرتبط بسجل بلاغات — يمكنك تحويله إلى خارج الخدمة بدلاً من حذفه");
    ambulances = ambulances.filter((a) => a.id !== Number(id));
    return { success: true, message: "تم حذف وحدة الإسعاف" };
  },

  getHospitals(onlyAvailable = false) {
    let list = [...hospitals];
    if (onlyAvailable) list = list.filter((h) => h.available_beds > 0);
    return { success: true, count: list.length, data: list };
  },

  createHospital(payload) {
    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);
    const total = Number(payload.total_beds);
    const avail = payload.available_beds !== undefined ? Number(payload.available_beds) : total;
    if (avail > total) throw new Error("الأسرة المتاحة لا يمكن أن تتجاوز إجمالي الأسرة");
    const created = {
      id: nextHospId++,
      name: payload.name,
      latitude: lat,
      longitude: lng,
      total_beds: total,
      available_beds: avail,
      node_id: payload.node_id || findNearestNodeId(lat, lng),
    };
    hospitals.unshift(created);
    return { success: true, data: created };
  },

  updateHospitalBeds(id, body) {
    const hosp = hospitals.find((h) => h.id === Number(id));
    if (!hosp) throw new Error("المستشفى غير موجود");
    const next =
      body.available_beds !== undefined
        ? Number(body.available_beds)
        : hosp.available_beds + Number(body.change || 0);
    if (next < 0) throw new Error("لا يمكن أن يقل عدد الأسرة المتاحة عن 0");
    if (next > hosp.total_beds) throw new Error(`الحد الأقصى للأسرة في هذا المستشفى هو ${hosp.total_beds}`);
    hosp.available_beds = next;
    return { success: true, data: hosp };
  },

  deleteHospital(id) {
    const used = reports.some((r) => r.hospital_id === Number(id));
    if (used) throw new Error("المستشفى مرتبط ببلاغات مسجلة ولا يمكن حذفه");
    hospitals = hospitals.filter((h) => h.id !== Number(id));
    return { success: true, message: "تم حذف المستشفى" };
  },

  getGraph() {
    return {
      success: true,
      source: "graph.json",
      data: {
        nodes: [...nodeMap.values()],
        edges: graphData.edges,
      },
    };
  },
};
