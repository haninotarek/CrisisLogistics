const db = require("../config/database");
const AppError = require("../utils/AppError");
const { validate, parseId } = require("../utils/validate");
const graphService = require("../services/graphService");

const HOSPITAL_SCHEMA = {
    name:           { type: "string", required: true, maxLength: 200 },
    latitude:       { type: "number", required: true, min: -90, max: 90 },
    longitude:      { type: "number", required: true, min: -180, max: 180 },
    total_beds:     { type: "integer", required: true, min: 0, max: 100000 },
    available_beds: { type: "integer", min: 0, max: 100000 },
    node_id:        { type: "string", maxLength: 10 }
};

const UPDATE_SCHEMA = Object.fromEntries(
    Object.entries(HOSPITAL_SCHEMA).map(([k, rule]) => [k, { ...rule, required: false, nullable: false }])
);

function checkBeds(total, available) {
    if (available > total) {
        throw AppError.badRequest("Validation failed", ["available_beds cannot be greater than total_beds"]);
    }
}

// GET /api/hospitals
const getAllHospitals = async (req, res) => {
    const { rows } = await db.query("SELECT * FROM hospitals ORDER BY id");
    res.json({ success: true, count: rows.length, data: rows });
};

// GET /api/hospitals/available?beds=2
const getAvailableHospitals = async (req, res) => {
    const beds = Math.max(1, Number.parseInt(req.query.beds, 10) || 1);
    const { rows } = await db.query(
        "SELECT * FROM hospitals WHERE available_beds >= $1 ORDER BY available_beds DESC, id", [beds]
    );
    res.json({ success: true, count: rows.length, data: rows });
};

// GET /api/hospitals/:id
const getHospitalById = async (req, res) => {
    const { rows } = await db.query("SELECT * FROM hospitals WHERE id = $1", [parseId(req.params.id)]);
    if (rows.length === 0) throw AppError.notFound("Hospital not found");
    res.json({ success: true, data: rows[0] });
};

// POST /api/hospitals
const createHospital = async (req, res) => {
    const data = validate(req.body, HOSPITAL_SCHEMA);
    const available = data.available_beds ?? data.total_beds;
    checkBeds(data.total_beds, available);
    const node_id = await graphService.resolveNodeId(data, { required: true });

    const { rows } = await db.query(
        `INSERT INTO hospitals (name, latitude, longitude, total_beds, available_beds, node_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [data.name, data.latitude, data.longitude, data.total_beds, available, node_id]
    );
    res.status(201).json({ success: true, data: rows[0] });
};

// PATCH /api/hospitals/:id   (any field, incl. beds)
const updateHospital = async (req, res) => {
    const id = parseId(req.params.id);
    const changes = validate(req.body, UPDATE_SCHEMA, { partial: true });

    const updated = await db.withTransaction(async (client) => {
        const { rows: [current] } = await client.query("SELECT * FROM hospitals WHERE id = $1 FOR UPDATE", [id]);
        if (!current) throw AppError.notFound("Hospital not found");

        checkBeds(changes.total_beds ?? current.total_beds, changes.available_beds ?? current.available_beds);

        if (("latitude" in changes || "longitude" in changes) && !changes.node_id) {
            changes.latitude ??= current.latitude;
            changes.longitude ??= current.longitude;
            changes.node_id = (await graphService.resolveNodeId(changes)) || current.node_id;
        } else if (changes.node_id) {
            await graphService.resolveNodeId(changes);
        }

        const fields = Object.keys(changes);
        const { rows: [row] } = await client.query(
            `UPDATE hospitals SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING *`,
            [id, ...fields.map((f) => changes[f])]
        );
        return row;
    });

    res.json({ success: true, data: updated });
};

// PATCH /api/hospitals/:id/beds   { "available_beds": 10 }  or  { "change": -1 }
const updateBeds = async (req, res) => {
    const id = parseId(req.params.id);
    const data = validate(req.body, {
        available_beds: { type: "integer", min: 0 },
        change:         { type: "integer", min: -100000, max: 100000 }
    });
    if ((data.available_beds === undefined) === (data.change === undefined)) {
        throw AppError.badRequest("Send exactly one of: available_beds (absolute) or change (+/- delta)");
    }

    const updated = await db.withTransaction(async (client) => {
        const { rows: [current] } = await client.query("SELECT * FROM hospitals WHERE id = $1 FOR UPDATE", [id]);
        if (!current) throw AppError.notFound("Hospital not found");

        const next = data.available_beds ?? current.available_beds + data.change;
        if (next < 0) throw AppError.badRequest("available_beds cannot go below 0");
        checkBeds(current.total_beds, next);

        const { rows: [row] } = await client.query(
            "UPDATE hospitals SET available_beds = $2 WHERE id = $1 RETURNING *", [id, next]
        );
        return row;
    });

    res.json({ success: true, data: updated });
};

// DELETE /api/hospitals/:id
const deleteHospital = async (req, res) => {
    const id = parseId(req.params.id);
    const { rows: used } = await db.query("SELECT 1 FROM reports WHERE hospital_id = $1 LIMIT 1", [id]);
    if (used.length > 0) throw AppError.conflict("Hospital is referenced by reports and cannot be deleted");
    const { rowCount } = await db.query("DELETE FROM hospitals WHERE id = $1", [id]);
    if (rowCount === 0) throw AppError.notFound("Hospital not found");
    res.json({ success: true, message: "Hospital deleted" });
};

module.exports = {
    getAllHospitals,
    getAvailableHospitals,
    getHospitalById,
    createHospital,
    updateHospital,
    updateBeds,
    deleteHospital
};
