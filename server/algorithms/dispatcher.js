/**
 * Chooses the best ambulance and hospital for a report.
 *
 * Pure functions: they receive candidates + a `distanceTo(entity)` function
 * (road distance in km from the patient, or null when unreachable) and return the choice.
 */

/** Nearest available ambulance. */
function selectAmbulance(ambulances, distanceTo) {
    let best = null;
    for (const amb of ambulances) {
        if (amb.status !== "available") continue;
        const d = distanceTo(amb);
        if (d === null || !Number.isFinite(d)) continue;
        if (!best || d < best.distance || (d === best.distance && amb.id < best.ambulance.id)) {
            best = { ambulance: amb, distance: d };
        }
    }
    return best;
}

/**
 * Best hospital that has enough free beds.
 * - Critical: strictly the nearest one (time matters most).
 * - Otherwise: distance + a small penalty for crowded hospitals, to spread the load.
 */
function selectHospital(hospitals, distanceTo, { severity, bedsNeeded = 1 } = {}) {
    let best = null;
    for (const h of hospitals) {
        if (h.available_beds < bedsNeeded) continue;
        const d = distanceTo(h);
        if (d === null || !Number.isFinite(d)) continue;

        let score = d;
        if (severity !== "Critical" && h.total_beds > 0) {
            const occupancy = 1 - h.available_beds / h.total_beds; // 0 = empty, 1 = full
            score += occupancy * 2; // up to +2 km equivalent
        }

        if (!best || score < best.score || (score === best.score && h.id < best.hospital.id)) {
            best = { hospital: h, distance: d, score };
        }
    }
    return best;
}

module.exports = { selectAmbulance, selectHospital };
