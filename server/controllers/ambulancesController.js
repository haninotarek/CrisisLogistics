const db = require("../config/database");
const AppError = require("../utils/AppError");
const { validate, parseId } = require("../utils/validate");
const graphService = require("../services/graphService");

const STATUSES = ["available", "busy", "offline"];

const AMBULANCE_SCHEMA = {
    name:      { type: "string", required: true, maxLength: 200 },
    latitude:  { type: "number", required: true, min: -90, max: 90 },
    longitude: { type: "number", required: true, min: -180, max: 180 },
    node_id:   { type: "string", maxLength: 10 },
    status:    { type: "string", enum: STATUSES }
};

const UPDATE_SCHEMA = {
    name:      { type: "string", maxLength: 200, nullable: false },
    latitude:  { type: "number", min: -90, max: 90, nullable: false },
    longitude: { type: "number", min: -180, max: 180, nullable: false },
    node_id:   { type: "string", maxLength: 10, nullable: false }
};

const AMBULANCE_SELECT = `
    SELECT a.*,
           r.id AS active_report_id
      FROM ambulances a
      LEFT JOIN reports r ON r.ambulance_id = a.id AND r.status = 'assigned'`;

// GET /api/ambulances?status=available
const getAllAmbulances = async (req, res) => {
    const params = [];
    let where = "";
    if (req.query.status) {
        if (!STATUSES.includes(req.query.status)) {
            throw AppError.badRequest(`status must be one of: ${STATUSES.join(", ")}`);
        }
        params.push(req.query.status);
        where = "WHERE a.status = $1";
    }
    const { rows } = await db.query(`${AMBULANCE_SELECT} ${where} ORDER BY a.id`, params);
    res.json({ success: true, count: rows.length, data: rows });
};

// GET /api/ambulances/:id
const getAmbulanceById = async (req, res) => {
    const { rows } = await db.query(`${AMBULANCE_SELECT} WHERE a.id = $1`, [parseId(req.params.id)]);
    if (rows.length === 0) throw AppError.notFound("Ambulance not found");
    res.json({ success: true, data: rows[0] });
};

// POST /api/ambulances
const createAmbulance = async (req, res) => {
    const data = validate(req.body, AMBULANCE_SCHEMA);
    if (data.status === "busy") {
        throw AppError.badRequest("A new ambulance cannot start as 'busy' (it is set automatically on dispatch)");
    }
    const node_id = await graphService.resolveNodeId(data, { required: true });

    const { rows } = await db.query(
        `INSERT INTO ambulances (name, latitude, longitude, status, node_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [data.name, data.latitude, data.longitude, data.status || "available", node_id]
    );
    res.status(201).json({ success: true, data: rows[0] });
};

// PATCH /api/ambulances/:id   (name / location)
const updateAmbulance = async (req, res) => {
    const id = parseId(req.params.id);
    const changes = validate(req.body, UPDATE_SCHEMA, { partial: true });

    const updated = await db.withTransaction(async (client) => {
        const { rows: [current] } = await client.query("SELECT * FROM ambulances WHERE id = $1 FOR UPDATE", [id]);
        if (!current) throw AppError.notFound("Ambulance not found");

        // Location moved without an explicit node -> snap to the nearest node again.
        if (("latitude" in changes || "longitude" in changes) && !changes.node_id) {
            changes.latitude ??= current.latitude;
            changes.longitude ??= current.longitude;
            changes.node_id = (await graphService.resolveNodeId(changes)) || current.node_id;
        } else if (changes.node_id) {
            await graphService.resolveNodeId(changes); // validates it exists
        }

        const fields = Object.keys(changes);
        const { rows: [row] } = await client.query(
            `UPDATE ambulances SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING *`,
            [id, ...fields.map((f) => changes[f])]
        );
        return row;
    });

    res.json({ success: true, data: updated });
};

// PATCH /api/ambulances/:id/status   { "status": "available" | "offline" }
const updateAmbulanceStatus = async (req, res) => {
    const id = parseId(req.params.id);
    const { status } = validate(req.body, { status: { type: "string", required: true, enum: STATUSES } });

    const updated = await db.withTransaction(async (client) => {
        const { rows: [current] } = await client.query("SELECT * FROM ambulances WHERE id = $1 FOR UPDATE", [id]);
        if (!current) throw AppError.notFound("Ambulance not found");

        const { rows: active } = await client.query(
            "SELECT id FROM reports WHERE ambulance_id = $1 AND status = 'assigned' LIMIT 1", [id]
        );
        if (active.length > 0) {
            throw AppError.conflict(
                `Ambulance is on report #${active[0].id} - complete or unassign that report first`
            );
        }
        if (status === "busy") {
            throw AppError.badRequest("'busy' is set automatically when the ambulance is dispatched");
        }

        const { rows: [row] } = await client.query(
            "UPDATE ambulances SET status = $2 WHERE id = $1 RETURNING *", [id, status]
        );
        return row;
    });

    res.json({ success: true, data: updated });
};

// DELETE /api/ambulances/:id
const deleteAmbulance = async (req, res) => {
    const id = parseId(req.params.id);
    const { rows: used } = await db.query("SELECT 1 FROM reports WHERE ambulance_id = $1 LIMIT 1", [id]);
    if (used.length > 0) {
        throw AppError.conflict("Ambulance has reports in its history - set it to 'offline' instead of deleting");
    }
    const { rowCount } = await db.query("DELETE FROM ambulances WHERE id = $1", [id]);
    if (rowCount === 0) throw AppError.notFound("Ambulance not found");
    res.json({ success: true, message: "Ambulance deleted" });
};

module.exports = {
    getAllAmbulances,
    getAmbulanceById,
    createAmbulance,
    updateAmbulance,
    updateAmbulanceStatus,
    deleteAmbulance
};
