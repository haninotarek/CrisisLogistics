const db = require("../config/database");
const AppError = require("../utils/AppError");
const { validate, parseId, parsePagination } = require("../utils/validate");
const graphService = require("../services/graphService");
const schemaInfo = require("../config/schemaInfo");
const dispatchService = require("../services/dispatchService");
const { triage, computePriorityScore, SEVERITIES } = require("../services/triageService");

const STATUSES = ["waiting", "assigned", "done"];
const BLEEDING = ["none", "mild", "moderate", "severe"];

const REPORT_SCHEMA = {
    latitude:        { type: "number", required: true, min: -90, max: 90 },
    longitude:       { type: "number", required: true, min: -180, max: 180 },
    node_id:         { type: "string", maxLength: 10 },
    patient_name:    { type: "string", maxLength: 100 },
    age:             { type: "integer", min: 0, max: 130 },
    injury_type:     { type: "string", required: true, maxLength: 100 },
    injured_count:   { type: "integer", min: 1, max: 1000 },
    conscious:       { type: "boolean", required: true },
    bleeding:        { type: "string", required: true, enum: BLEEDING },
    breathing_issue: { type: "boolean" },
    pain_level:      { type: "integer", min: 0, max: 10 },
    severity:        { type: "string", enum: SEVERITIES }, // optional manual override
    reporter_name:   { type: "string", maxLength: 100 },
    reporter_phone:  { type: "string", maxLength: 20 }
};

// Fields that may be edited later. Clinical ones only while the report is still waiting.
const CONTACT_FIELDS = ["patient_name", "age", "reporter_name", "reporter_phone"];
const CLINICAL_FIELDS = ["injury_type", "injured_count", "conscious", "bleeding", "breathing_issue", "pain_level", "severity"];
const UPDATE_SCHEMA = Object.fromEntries(
    [...CONTACT_FIELDS, ...CLINICAL_FIELDS].map((f) => [
        f,
        { ...REPORT_SCHEMA[f], required: false, nullable: CONTACT_FIELDS.includes(f) || f === "pain_level" }
    ])
);

const PHONE_RE = /^\+?[0-9][0-9\s-]{3,18}$/;

const REPORT_SELECT = `
    SELECT r.*,
           a.name AS ambulance_name,
           h.name AS hospital_name
      FROM reports r
      LEFT JOIN ambulances a ON a.id = r.ambulance_id
      LEFT JOIN hospitals  h ON h.id = r.hospital_id`;

async function findReport(id) {
    const { rows } = await db.query(`${REPORT_SELECT} WHERE r.id = $1`, [id]);
    if (rows.length === 0) throw AppError.notFound("Report not found");
    return rows[0];
}

// GET /api/reports?status=&severity=&limit=&offset=
const getAllReports = async (req, res) => {
    const where = [];
    const params = [];

    if (req.query.status) {
        if (!STATUSES.includes(req.query.status)) {
            throw AppError.badRequest(`status must be one of: ${STATUSES.join(", ")}`);
        }
        params.push(req.query.status);
        where.push(`r.status = $${params.length}`);
    }
    if (req.query.severity) {
        const sev = SEVERITIES.find((s) => s.toLowerCase() === String(req.query.severity).toLowerCase());
        if (!sev) throw AppError.badRequest(`severity must be one of: ${SEVERITIES.join(", ")}`);
        params.push(sev);
        where.push(`r.severity = $${params.length}`);
    }

    const { limit, offset } = parsePagination(req.query);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [list, total] = await Promise.all([
        db.query(
            `${REPORT_SELECT} ${whereSql} ORDER BY r.created_at DESC, r.id DESC LIMIT ${limit} OFFSET ${offset}`,
            params
        ),
        db.query(`SELECT COUNT(*)::int AS total FROM reports r ${whereSql}`, params)
    ]);

    res.json({ success: true, count: list.rows.length, total: total.rows[0].total, limit, offset, data: list.rows });
};

// GET /api/reports/queue  -> waiting reports ordered by priority (heap-based)
const getQueue = async (req, res) => {
    const queue = await dispatchService.getWaitingQueue();
    res.json({ success: true, count: queue.length, data: queue });
};

// GET /api/reports/:id
const getReportById = async (req, res) => {
    const report = await findReport(parseId(req.params.id));
    res.json({ success: true, data: report });
};

// GET /api/reports/:id/route  -> map route for an assigned/done report
const getReportRoute = async (req, res) => {
    const report = await findReport(parseId(req.params.id));
    if (!report.ambulance_id && !report.hospital_id) {
        throw AppError.conflict("Report has no ambulance/hospital assigned yet");
    }
    const [amb, hosp] = await Promise.all([
        report.ambulance_id ? db.query("SELECT * FROM ambulances WHERE id = $1", [report.ambulance_id]) : { rows: [] },
        report.hospital_id ? db.query("SELECT * FROM hospitals WHERE id = $1", [report.hospital_id]) : { rows: [] }
    ]);
    const ambulance = report.status === "assigned" ? amb.rows[0] : null; // after 'done' the ambulance has moved on
    const route = await dispatchService.buildRoutes(report, ambulance, hosp.rows[0]);
    res.json({ success: true, data: route });
};

// POST /api/reports   (?auto_dispatch=true to assign immediately)
const createReport = async (req, res) => {
    const data = validate(req.body, REPORT_SCHEMA);
    if (data.reporter_phone && !PHONE_RE.test(data.reporter_phone)) {
        throw AppError.badRequest("Validation failed", ["reporter_phone is not a valid phone number"]);
    }

    const c = {
        ...data,
        injured_count: data.injured_count ?? 1,
        breathing_issue: data.breathing_issue ?? false,
        pain_level: data.pain_level ?? null,
        age: data.age ?? null
    };

    const node_id = await graphService.resolveNodeId(c);
    const result = await triage(c, data.severity);

    const report = await db.withTransaction(async (client) => {
        const { rows: [inserted] } = await client.query(
            `INSERT INTO reports
                (latitude, longitude, node_id, patient_name, age, injury_type, injured_count,
                 conscious, bleeding, breathing_issue, pain_level, severity,
                 reporter_name, reporter_phone, priority_score, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'waiting')
             RETURNING id`,
            [
                c.latitude, c.longitude, node_id, c.patient_name ?? null, c.age, c.injury_type, c.injured_count,
                c.conscious, c.bleeding, c.breathing_issue, c.pain_level, result.severity,
                c.reporter_name ?? null, c.reporter_phone ?? null, result.priority_score
            ]
        );
        // incident_code exists in the ERD but not in the original dump -> only fill it if the column exists.
        const sql = (await schemaInfo.hasColumn("reports", "incident_code"))
            ? `UPDATE reports
                  SET incident_code = 'INC-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(id::text, 5, '0')
                WHERE id = $1
            RETURNING *`
            : "SELECT * FROM reports WHERE id = $1";
        const { rows: [row] } = await client.query(sql, [inserted.id]);
        return row;
    });

    const response = { success: true, triage_source: result.source, data: report };

    if (String(req.query.auto_dispatch).toLowerCase() === "true") {
        try {
            response.dispatch = await dispatchService.assignReport(report.id);
            response.data = response.dispatch.report;
        } catch (error) {
            if (!(error instanceof AppError)) throw error;
            response.dispatch_error = error.message; // report is saved and stays in the queue
        }
    }

    res.status(201).json(response);
};

// PATCH /api/reports/:id
const updateReport = async (req, res) => {
    const id = parseId(req.params.id);
    const changes = validate(req.body, UPDATE_SCHEMA, { partial: true });
    if (changes.reporter_phone && !PHONE_RE.test(changes.reporter_phone)) {
        throw AppError.badRequest("Validation failed", ["reporter_phone is not a valid phone number"]);
    }

    const updated = await db.withTransaction(async (client) => {
        const { rows: [current] } = await client.query("SELECT * FROM reports WHERE id = $1 FOR UPDATE", [id]);
        if (!current) throw AppError.notFound("Report not found");

        const clinicalChanged = CLINICAL_FIELDS.some((f) => f in changes);
        if (clinicalChanged && current.status !== "waiting") {
            throw AppError.conflict(
                `Medical details can only be changed while the report is 'waiting' (it is '${current.status}')`
            );
        }

        if (clinicalChanged) {
            const merged = { ...current, ...changes };
            changes.priority_score = computePriorityScore(merged, merged.severity);
        }

        const fields = Object.keys(changes);
        const setSql = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
        const { rows: [row] } = await client.query(
            `UPDATE reports SET ${setSql} WHERE id = $1 RETURNING *`,
            [id, ...fields.map((f) => changes[f])]
        );
        return row;
    });

    res.json({ success: true, data: updated });
};

// POST /api/reports/:id/assign
const assignReport = async (req, res) => {
    const result = await dispatchService.assignReport(parseId(req.params.id));
    res.json({ success: true, data: result });
};

// POST /api/reports/:id/complete
const completeReport = async (req, res) => {
    const result = await dispatchService.completeReport(parseId(req.params.id));
    res.json({ success: true, data: result });
};

// POST /api/reports/:id/unassign
const unassignReport = async (req, res) => {
    const result = await dispatchService.unassignReport(parseId(req.params.id));
    res.json({ success: true, data: result });
};

// PATCH /api/reports/:id/status  { "status": "assigned" | "done" | "waiting" }
// One entry point for status changes; each one goes through the matching safe transition.
const updateReportStatus = async (req, res) => {
    const id = parseId(req.params.id);
    const { status } = validate(req.body, { status: { type: "string", required: true, enum: STATUSES } });
    const action = {
        assigned: dispatchService.assignReport,
        done: dispatchService.completeReport,
        waiting: dispatchService.unassignReport
    }[status];
    const result = await action(id);
    res.json({ success: true, data: result });
};

// DELETE /api/reports/:id   (not allowed while an ambulance is on the way)
const deleteReport = async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await db.query(
        "DELETE FROM reports WHERE id = $1 AND status <> 'assigned' RETURNING id", [id]
    );
    if (rows.length === 0) {
        const exists = await db.query("SELECT status FROM reports WHERE id = $1", [id]);
        if (exists.rows.length === 0) throw AppError.notFound("Report not found");
        throw AppError.conflict("Report is assigned to an ambulance - unassign or complete it first");
    }
    res.json({ success: true, message: "Report deleted" });
};

module.exports = {
    getAllReports,
    getQueue,
    getReportById,
    getReportRoute,
    createReport,
    updateReport,
    assignReport,
    completeReport,
    unassignReport,
    updateReportStatus,
    deleteReport
};
