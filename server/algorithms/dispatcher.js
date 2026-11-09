const AMBULANCE_STATUS = Object.freeze({ AVAILABLE: "available", BUSY: "busy", OFFLINE: "offline" });
const REPORT_STATUS = Object.freeze({ WAITING: "waiting", ASSIGNED: "assigned" });

const WAIT_REASON = Object.freeze({
    NO_AMBULANCE: "No ambulance is available right now",
    NO_REACHABLE_AMBULANCE: "No reachable ambulance for this location",
    NO_HOSPITAL: "No hospital has enough free beds right now",
    NO_REACHABLE_HOSPITAL: "No reachable hospital with free beds for this location"
});

const DEFAULT_SPEED_KMH = 60;
const OCCUPANCY_PENALTY_KM = 2;

const isValidDistance = (d) => d !== null && d !== undefined && Number.isFinite(d) && d >= 0;
const round = (n, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

function etaMinutes(km, speedKmh = DEFAULT_SPEED_KMH) {
    if (!isValidDistance(km) || !(speedKmh > 0)) return null;
    return Math.max(1, Math.round((km / speedKmh) * 60));
}

function bedsNeededFor(report = {}) {
    const n = Number.parseInt(report.injured_count, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

function selectAmbulance(ambulances, distanceTo) {
    let best = null;
    for (const amb of ambulances || []) {
        if (!amb || amb.status !== AMBULANCE_STATUS.AVAILABLE) continue;
        const d = distanceTo(amb);
        if (!isValidDistance(d)) continue;
        if (!best || d < best.distance || (d === best.distance && amb.id < best.ambulance.id)) {
            best = { ambulance: amb, distance: d };
        }
    }
    return best;
}

function selectHospital(hospitals, distanceTo, { severity, bedsNeeded = 1 } = {}) {
    let best = null;
    for (const h of hospitals || []) {
        if (!h || !(Number(h.available_beds) >= bedsNeeded)) continue;
        const d = distanceTo(h);
        if (!isValidDistance(d)) continue;

        let score = d;
        const total = Number(h.total_beds);
        if (severity !== "Critical" && total > 0) {
            const occupancy = Math.min(1, Math.max(0, 1 - Number(h.available_beds) / total));
            score += occupancy * OCCUPANCY_PENALTY_KM;
        }

        if (!best || score < best.score || (score === best.score && h.id < best.hospital.id)) {
            best = { hospital: h, distance: d, score };
        }
    }
    return best;
}

function decideForReport(report, ambulances, hospitals, distanceTo, { speedKmh = DEFAULT_SPEED_KMH } = {}) {
    const available = (ambulances || []).filter((a) => a && a.status === AMBULANCE_STATUS.AVAILABLE);
    if (available.length === 0) return { status: REPORT_STATUS.WAITING, reason: WAIT_REASON.NO_AMBULANCE };

    const amb = selectAmbulance(available, distanceTo);
    if (!amb) return { status: REPORT_STATUS.WAITING, reason: WAIT_REASON.NO_REACHABLE_AMBULANCE };

    const bedsNeeded = bedsNeededFor(report);
    const withBeds = (hospitals || []).filter((h) => h && Number(h.available_beds) >= bedsNeeded);
    if (withBeds.length === 0) return { status: REPORT_STATUS.WAITING, reason: WAIT_REASON.NO_HOSPITAL };

    const hosp = selectHospital(withBeds, distanceTo, { severity: report.severity, bedsNeeded });
    if (!hosp) return { status: REPORT_STATUS.WAITING, reason: WAIT_REASON.NO_REACHABLE_HOSPITAL };

    const total = amb.distance + hosp.distance;
    return {
        status: REPORT_STATUS.ASSIGNED,
        ambulance: amb.ambulance,
        hospital: hosp.hospital,
        beds_needed: bedsNeeded,
        ambulance_distance_km: round(amb.distance),
        hospital_distance_km: round(hosp.distance),
        total_distance_km: round(total),
        eta_to_patient_minutes: etaMinutes(amb.distance, speedKmh),
        eta_to_hospital_minutes: etaMinutes(hosp.distance, speedKmh),
        total_eta_minutes: etaMinutes(total, speedKmh)
    };
}

function planDispatch(sortedReports, ambulances, hospitals, distanceFor, { speedKmh = DEFAULT_SPEED_KMH, max = Infinity } = {}) {
    const ambState = (ambulances || []).map((a) => ({ ...a }));
    const hospState = (hospitals || []).map((h) => ({ ...h }));
    const assignments = [];
    const waiting = [];

    for (const report of sortedReports || []) {
        if (report.status && report.status !== REPORT_STATUS.WAITING) continue;

        if (assignments.length >= max) {
            waiting.push({ report, reason: "Dispatch limit reached for this round" });
            continue;
        }

        const decision = decideForReport(report, ambState, hospState, distanceFor(report), { speedKmh });
        if (decision.status !== REPORT_STATUS.ASSIGNED) {
            waiting.push({ report: { ...report, status: REPORT_STATUS.WAITING }, reason: decision.reason });
            continue;
        }

        decision.ambulance.status = AMBULANCE_STATUS.BUSY;
        decision.hospital.available_beds = Number(decision.hospital.available_beds) - decision.beds_needed;

        const { status, ...details } = decision;
        assignments.push({
            ...details,
            report: {
                ...report,
                status: REPORT_STATUS.ASSIGNED,
                ambulance_id: decision.ambulance.id,
                hospital_id: decision.hospital.id
            },
            ambulance: { ...decision.ambulance },
            hospital: { ...decision.hospital }
        });
    }

    return { assignments, waiting, ambulances: ambState, hospitals: hospState };
}

module.exports = {
    AMBULANCE_STATUS,
    REPORT_STATUS,
    WAIT_REASON,
    etaMinutes,
    bedsNeededFor,
    selectAmbulance,
    selectHospital,
    decideForReport,
    planDispatch
};
