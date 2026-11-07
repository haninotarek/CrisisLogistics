/**
 * Road graph + routing for the backend.
 * All path-finding is done by the team's algorithm in algorithms/dijkstra.js (Ain Gamal);
 * this service only decides WHERE the graph comes from and adapts DB rows to it.
 *
 * Graph source (first one that has nodes):
 *   1. `nodes` / `edges` tables (ERD)  -> filled by `npm run db:seed` from graph.json
 *   2. server/data/graph.json           -> the team's road network
 * If an entity has no reachable node, distance falls back to straight-line x ROAD_FACTOR
 * and the route is marked `approximate: true`.
 */
const db = require("../config/database");
const schemaInfo = require("../config/schemaInfo");
const AppError = require("../utils/AppError");
const { defaultGraph, buildAdjacency, dijkstra, haversineDistance } = require("../algorithms/dijkstra");

const CACHE_TTL_MS = 30 * 1000;
const ROAD_FACTOR = 1.4;

let cache = null; // { nodes: Map, edges: [], graph, source, loadedAt }
let loading = null;

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/** Builds the object shape algorithms/dijkstra.js expects, with its adjacency pre-cached. */
function toAlgorithmGraph(nodes, edges) {
    const graph = {
        nodes: nodes.map((n) => ({ ...n, id: n.node_id, lat: n.latitude, lng: n.longitude })),
        edges: edges.map((e) => ({ from: e.from_node, to: e.to_node, distance: Number(e.distance_km) }))
    };
    graph._adjCache = buildAdjacency(graph); // buildAdjacency returns _adjCache when present
    return graph;
}

async function loadFromDatabase() {
    if (!(await schemaInfo.hasTable("nodes")) || !(await schemaInfo.hasTable("edges"))) return null;
    const [nodesRes, edgesRes] = await Promise.all([
        db.query("SELECT node_id, latitude, longitude FROM nodes ORDER BY node_id"),
        db.query("SELECT id, from_node, to_node, distance_km FROM edges ORDER BY id")
    ]);
    if (nodesRes.rows.length === 0) return null;
    return { nodes: nodesRes.rows, edges: edgesRes.rows, source: "database" };
}

function loadFromGraphJson() {
    const nodes = (defaultGraph.nodes || []).map((n) => ({
        node_id: n.id, latitude: n.lat, longitude: n.lng, name: n.name, type: n.type
    }));
    const edges = (defaultGraph.edges || []).map((e) => ({
        from_node: e.from, to_node: e.to, distance_km: e.distance
    }));
    return { nodes, edges, source: nodes.length ? "graph.json" : "none" };
}

async function loadGraph({ force = false } = {}) {
    if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
    if (loading) return loading;

    loading = (async () => {
        const data = (await loadFromDatabase()) || loadFromGraphJson();
        cache = {
            nodes: new Map(data.nodes.map((n) => [n.node_id, n])),
            edges: data.edges,
            graph: data.source === "graph.json" ? defaultGraph : toAlgorithmGraph(data.nodes, data.edges),
            source: data.source,
            loadedAt: Date.now()
        };
        return cache;
    })();

    try {
        return await loading;
    } finally {
        loading = null;
    }
}

/** Call after any change to nodes/edges. */
function invalidate() {
    cache = null;
    schemaInfo.reset();
}

/** Closest graph node to a coordinate, or null when there are no nodes. */
async function nearestNode(latitude, longitude) {
    const { nodes } = await loadGraph();
    let best = null;
    for (const n of nodes.values()) {
        const d = haversineDistance(latitude, longitude, n.latitude, n.longitude);
        if (!best || d < best.distance) best = { node_id: n.node_id, distance: d };
    }
    return best;
}

/** Shortest path between two node ids (team Dijkstra). */
async function shortestPath(fromId, toId) {
    const { graph } = await loadGraph();
    return dijkstra(fromId, toId, graph);
}

/**
 * Distance/route helpers around one point (the patient).
 * Entities need { node_id, latitude, longitude }.
 *   distanceTo(entity)  road km between entity and patient (memoised per node)
 *   routeFrom(entity)   entity  -> patient   (ambulance leg)
 *   routeTo(entity)     patient -> entity    (hospital leg)
 */
async function fromOrigin(origin) {
    const { graph, nodes } = await loadGraph();
    const originOnGraph = origin.node_id && nodes.has(origin.node_id);
    const memo = new Map();

    const straightLine = (entity) => {
        const pts = [origin.latitude, origin.longitude, entity.latitude, entity.longitude];
        if (!pts.every(Number.isFinite)) return null;
        return haversineDistance(origin.latitude, origin.longitude, entity.latitude, entity.longitude) * ROAD_FACTOR;
    };

    const graphRoute = (from, to) => {
        if (!originOnGraph || !nodes.has(from) || !nodes.has(to)) return null;
        const r = dijkstra(from, to, graph);
        return r.found ? r : null;
    };

    const distanceTo = (entity) => {
        const key = entity.node_id;
        if (memo.has(key)) return memo.get(key);
        const r = graphRoute(origin.node_id, entity.node_id); // roads are two-way
        const d = r ? r.distance : straightLine(entity);
        memo.set(key, d);
        return d;
    };

    const format = (r, fromPoint, toPoint, entity) => {
        if (r) {
            return {
                distance_km: round(r.distance),
                approximate: false,
                path: r.path,
                coordinates: r.coordinates
            };
        }
        const d = straightLine(entity);
        return {
            distance_km: d === null ? null : round(d),
            approximate: true, // no road path -> straight-line estimate
            path: [],
            coordinates: [fromPoint, toPoint]
        };
    };

    const originPoint = [origin.latitude, origin.longitude];
    const routeFrom = (entity) =>
        format(graphRoute(entity.node_id, origin.node_id), [entity.latitude, entity.longitude], originPoint, entity);
    const routeTo = (entity) =>
        format(graphRoute(origin.node_id, entity.node_id), originPoint, [entity.latitude, entity.longitude], entity);

    return { distanceTo, routeFrom, routeTo };
}

/**
 * Decides which graph node an entity sits on:
 * - explicit node_id -> must exist (when a graph is loaded)
 * - otherwise        -> nearest node to (latitude, longitude)
 */
async function resolveNodeId({ node_id, latitude, longitude }, { required = false } = {}) {
    if (node_id) {
        const { nodes } = await loadGraph({ force: true });
        if (nodes.size > 0 && !nodes.has(node_id)) {
            throw AppError.badRequest(`node_id '${node_id}' does not exist in the road graph`);
        }
        return node_id;
    }
    const nearest = await nearestNode(latitude, longitude);
    if (!nearest && required) {
        throw AppError.badRequest("node_id is required (no nodes exist yet to auto-detect the nearest one)");
    }
    return nearest ? nearest.node_id : null;
}

module.exports = {
    loadGraph,
    invalidate,
    nearestNode,
    shortestPath,
    fromOrigin,
    resolveNodeId,
    haversineKm: haversineDistance
};
