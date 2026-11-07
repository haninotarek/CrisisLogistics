const db = require("../config/database");
const AppError = require("../utils/AppError");
const { validate, parseId } = require("../utils/validate");
const graphService = require("../services/graphService");

const NODE_SCHEMA = {
    node_id:   { type: "string", required: true, maxLength: 10 },
    latitude:  { type: "number", required: true, min: -90, max: 90 },
    longitude: { type: "number", required: true, min: -180, max: 180 }
};

const EDGE_SCHEMA = {
    from_node:   { type: "string", required: true, maxLength: 10 },
    to_node:     { type: "string", required: true, maxLength: 10 },
    distance_km: { type: "number", min: 0, max: 999999 } // optional: computed from coordinates if missing
};

// GET /api/graph  -> everything the map needs (from DB tables, or graph.json as fallback)
const getGraph = async (req, res) => {
    const { nodes, edges, source } = await graphService.loadGraph({ force: true });
    res.json({ success: true, source, data: { nodes: [...nodes.values()], edges } });
};

// GET /api/graph/nodes
const getNodes = async (req, res) => {
    const { nodes, source } = await graphService.loadGraph({ force: true });
    res.json({ success: true, source, count: nodes.size, data: [...nodes.values()] });
};

// POST /api/graph/nodes
const createNode = async (req, res) => {
    const data = validate(req.body, NODE_SCHEMA);
    const { rows } = await db.query(
        "INSERT INTO nodes (node_id, latitude, longitude) VALUES ($1, $2, $3) RETURNING *",
        [data.node_id, data.latitude, data.longitude]
    );
    graphService.invalidate();
    res.status(201).json({ success: true, data: rows[0] });
};

// DELETE /api/graph/nodes/:nodeId
const deleteNode = async (req, res) => {
    const nodeId = String(req.params.nodeId);
    const { rows: used } = await db.query(
        `SELECT 'ambulance' AS kind FROM ambulances WHERE node_id = $1
         UNION ALL SELECT 'hospital' FROM hospitals WHERE node_id = $1
         LIMIT 1`,
        [nodeId]
    );
    if (used.length > 0) throw AppError.conflict(`Node is used by a ${used[0].kind} and cannot be deleted`);

    const { rowCount } = await db.query("DELETE FROM nodes WHERE node_id = $1", [nodeId]);
    if (rowCount === 0) throw AppError.notFound("Node not found");
    graphService.invalidate();
    res.json({ success: true, message: "Node deleted (its edges were removed too)" });
};

// GET /api/graph/edges
const getEdges = async (req, res) => {
    const { edges, source } = await graphService.loadGraph({ force: true });
    res.json({ success: true, source, count: edges.length, data: edges });
};

// POST /api/graph/edges
const createEdge = async (req, res) => {
    const data = validate(req.body, EDGE_SCHEMA);
    if (data.from_node === data.to_node) throw AppError.badRequest("from_node and to_node must be different");

    const { nodes } = await graphService.loadGraph({ force: true });
    const a = nodes.get(data.from_node);
    const b = nodes.get(data.to_node);
    if (!a || !b) throw AppError.badRequest(`Unknown node: ${!a ? data.from_node : data.to_node}`);

    const reverse = await db.query(
        "SELECT id FROM edges WHERE from_node = $1 AND to_node = $2", [data.to_node, data.from_node]
    );
    if (reverse.rows.length > 0) {
        throw AppError.conflict(`Road already exists (edge #${reverse.rows[0].id}) - roads are two-way`);
    }

    const distance = data.distance_km ?? Math.round(graphService.haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 100) / 100;
    const { rows } = await db.query(
        "INSERT INTO edges (from_node, to_node, distance_km) VALUES ($1, $2, $3) RETURNING *",
        [data.from_node, data.to_node, distance]
    );
    graphService.invalidate();
    res.status(201).json({ success: true, data: rows[0] });
};

// DELETE /api/graph/edges/:id
const deleteEdge = async (req, res) => {
    const { rowCount } = await db.query("DELETE FROM edges WHERE id = $1", [parseId(req.params.id)]);
    if (rowCount === 0) throw AppError.notFound("Edge not found");
    graphService.invalidate();
    res.json({ success: true, message: "Edge deleted" });
};

// GET /api/graph/route?from=N1&to=N5
const getRoute = async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) throw AppError.badRequest("Query params 'from' and 'to' (node ids) are required");

    const { nodes } = await graphService.loadGraph();
    for (const id of [from, to]) {
        if (!nodes.has(id)) throw AppError.notFound(`Node '${id}' not found`);
    }

    const route = await graphService.shortestPath(from, to); // team Dijkstra
    if (!route.found) throw AppError.notFound(`No road connects ${from} and ${to}`);

    res.json({
        success: true,
        data: {
            from,
            to,
            distance_km: route.distance,
            path: route.path,
            coordinates: route.coordinates,
            visited_nodes: route.visitedCount
        }
    });
};

// GET /api/graph/nearest?lat=30.04&lng=31.23
const getNearestNode = async (req, res) => {
    const { latitude, longitude } = validate(
        { latitude: req.query.lat, longitude: req.query.lng },
        { latitude: NODE_SCHEMA.latitude, longitude: NODE_SCHEMA.longitude }
    );
    const nearest = await graphService.nearestNode(latitude, longitude);
    if (!nearest) throw AppError.notFound("No nodes exist yet");
    res.json({ success: true, data: { node_id: nearest.node_id, distance_km: Math.round(nearest.distance * 1000) / 1000 } });
};

module.exports = {
    getGraph,
    getNodes,
    createNode,
    deleteNode,
    getEdges,
    createEdge,
    deleteEdge,
    getRoute,
    getNearestNode
};
