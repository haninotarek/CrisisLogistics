const db = require("../config/database");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const graphService = require("./graphService");
const { selectAmbulance, selectHospital } = require("../algorithms/dispatcher");
const { sortReportsByPriority } = require("./queueService");

const etaMinutes = (km) => (km === null ? null : Math.max(1, Math.round((km / env.AVG_SPEED_KMH) * 60)));

/** Builds both route legs for a report already linked to an ambulance + hospital. */
async function buildRoutes(report, ambulance, hospital) {
    const { routeFrom, routeTo } = await graphService.fromOrigin(report);
    const toPatient = ambulance ? routeFrom(ambulance) : null;
    const toHospital = hospital ? routeTo(hospital) : null;
    const total = (toPatient?.distance_km ?? 0) + (toHospital?.distance_km ?? 0);
    return {
        ambulance_to_patient: toPatient && { ...toPatient, eta_minutes: etaMinutes(toPatient.distance_km) },
        patient_to_hospital: toHospital && { ...toHospital, eta_minutes: etaMinutes(toHospital.distance_km) },
        total_distance_km: Math.round(total * 1000) / 1000,
        total_eta_minutes: etaMinutes(total)
    };
}

/**
 * Assigns the nearest available ambulance and the best hospital to a waiting report.
 * Runs in one transaction with row locks so two operators can never grab the same
 * ambulance or the last bed at the same time.
 */
async function assignReport(reportId) {
    return db.withTransaction(async (client) => {
        const { rows: [report] } = await client.query(
            "SELECT * FROM reports WHERE id = $1 FOR UPDATE", [reportId]
        );
        if (!report) throw AppError.notFound("Report not found");
        if (report.status !== "waiting") {
            throw AppError.conflict(`Report is already '${report.status}', only 'waiting' reports can be assigned`);
        }

        const { rows: ambulances } = await client.query(
            "SELECT * FROM ambulances WHERE status = 'available' ORDER BY id FOR UPDATE"
        );
        if (ambulances.length === 0) throw AppError.conflict("No ambulance is available right now");

        const bedsNeeded = report.injured_count || 1;
        const { rows: hospitals } = await client.query(
            "SELECT * FROM hospitals WHERE available_beds >= $1 ORDER BY id FOR UPDATE", [bedsNeeded]
        );
        if (hospitals.length === 0) {
            throw AppError.conflict(`No hospital has ${bedsNeeded} free bed(s) right now`);
        }

        const { distanceTo } = await graphService.fromOrigin(report);
        const amb = selectAmbulance(ambulances, distanceTo);
        if (!amb) throw AppError.conflict("No reachable ambulance for this location");
        const hosp = selectHospital(hospitals, distanceTo, { severity: report.severity, bedsNeeded });
        if (!hosp) throw AppError.conflict("No reachable hospital with free beds for this location");

        await client.query("UPDATE ambulances SET status = 'busy' WHERE id = $1", [amb.ambulance.id]);
        const { rows: [hospital] } = await client.query(
            "UPDATE hospitals SET available_beds = available_beds - $2 WHERE id = $1 RETURNING *",
            [hosp.hospital.id, bedsNeeded]
        );
        const { rows: [updated] } = await client.query(
            `UPDATE reports
                SET status = 'assigned', ambulance_id = $2, hospital_id = $3, assigned_at = NOW()
              WHERE id = $1
          RETURNING *`,
            [report.id, amb.ambulance.id, hospital.id]
        );

        const ambulance = { ...amb.ambulance, status: "busy" };
        return {
            report: updated,
            ambulance,
            hospital,
            route: await buildRoutes(updated, ambulance, hospital)
        };
    });
}

/** Marks an assigned report as done; the ambulance becomes available at the hospital's location. */
async function completeReport(reportId) {
    return db.withTransaction(async (client) => {
        const { rows: [report] } = await client.query(
            "SELECT * FROM reports WHERE id = $1 FOR UPDATE", [reportId]
        );
        if (!report) throw AppError.notFound("Report not found");
        if (report.status !== "assigned") {
            throw AppError.conflict(`Report is '${report.status}', only 'assigned' reports can be completed`);
        }

        const { rows: [updated] } = await client.query(
            "UPDATE reports SET status = 'done', completed_at = NOW() WHERE id = $1 RETURNING *",
            [report.id]
        );

        let ambulance = null;
        if (report.ambulance_id) {
            const { rows: [hospital] } = report.hospital_id
                ? await client.query("SELECT node_id, latitude, longitude FROM hospitals WHERE id = $1", [report.hospital_id])
                : { rows: [] };
            ({ rows: [ambulance] } = await client.query(
                `UPDATE ambulances
                    SET status    = 'available',
                        node_id   = COALESCE($2, node_id),
                        latitude  = COALESCE($3, latitude),
                        longitude = COALESCE($4, longitude)
                  WHERE id = $1
              RETURNING *`,
                [report.ambulance_id, hospital?.node_id ?? null, hospital?.latitude ?? null, hospital?.longitude ?? null]
            ));
        }
        return { report: updated, ambulance };
    });
}

/**
 * Undo an assignment (e.g. ambulance broke down): report back to 'waiting',
 * ambulance back to 'available', reserved beds released.
 */
async function unassignReport(reportId) {
    return db.withTransaction(async (client) => {
        const { rows: [report] } = await client.query(
            "SELECT * FROM reports WHERE id = $1 FOR UPDATE", [reportId]
        );
        if (!report) throw AppError.notFound("Report not found");
        if (report.status !== "assigned") {
            throw AppError.conflict(`Report is '${report.status}', only 'assigned' reports can be unassigned`);
        }

        if (report.ambulance_id) {
            await client.query("UPDATE ambulances SET status = 'available' WHERE id = $1", [report.ambulance_id]);
        }
        if (report.hospital_id) {
            await client.query(
                "UPDATE hospitals SET available_beds = LEAST(total_beds, available_beds + $2) WHERE id = $1",
                [report.hospital_id, report.injured_count || 1]
            );
        }
        const { rows: [updated] } = await client.query(
            `UPDATE reports
                SET status = 'waiting', ambulance_id = NULL, hospital_id = NULL, assigned_at = NULL
              WHERE id = $1
          RETURNING *`,
            [report.id]
        );
        return { report: updated };
    });
}

async function getWaitingQueue() {
    const { rows } = await db.query("SELECT * FROM reports WHERE status = 'waiting'");
    return sortReportsByPriority(rows);
}

/**
 * Dispatches waiting reports in priority order until ambulances run out.
 * `max` limits how many to dispatch (1 = only the most urgent one).
 */
async function dispatchQueue({ max = Infinity } = {}) {
    const queue = await getWaitingQueue();
    const assigned = [];
    const skipped = [];

    for (const item of queue) {
        if (assigned.length >= max) break;
        try {
            assigned.push(await assignReport(item.id));
        } catch (error) {
            if (!(error instanceof AppError)) throw error;
            skipped.push({ report_id: item.id, reason: error.message });
            if (/No ambulance is available/.test(error.message)) break; // nothing more can be done
        }
    }
    return { assigned, skipped, remaining_in_queue: queue.length - assigned.length };
}

module.exports = { assignReport, completeReport, unassignReport, getWaitingQueue, dispatchQueue, buildRoutes };
