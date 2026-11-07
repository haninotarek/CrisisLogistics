/**
 * Seeds the database from the team's road network in server/data/graph.json.
 *   nodes      <- every graph node                (upsert, safe to re-run)
 *   edges      <- every graph edge                (skips existing)
 *   hospitals  <- nodes with type "hospital"      (only if the table is empty)
 *   ambulances <- nodes with type "ambulance"     (only if the table is empty)
 *
 * Usage:  npm run db:seed      (run `npm run db:init` first)
 */
const { pool } = require("../config/database");
const graph = require("../data/graph.json");

async function main() {
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    if (nodes.length === 0) {
        console.log("graph.json has no nodes - nothing to seed.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        for (const n of nodes) {
            await client.query(
                `INSERT INTO nodes (node_id, latitude, longitude) VALUES ($1, $2, $3)
                 ON CONFLICT (node_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
                [n.id, n.lat, n.lng]
            );
        }

        let edgeCount = 0;
        for (const e of edges) {
            const res = await client.query(
                `INSERT INTO edges (from_node, to_node, distance_km)
                 SELECT $1::varchar, $2::varchar, $3::numeric
                 WHERE NOT EXISTS (
                     SELECT 1 FROM edges
                      WHERE (from_node = $1::varchar AND to_node = $2::varchar)
                         OR (from_node = $2::varchar AND to_node = $1::varchar))`,
                [e.from, e.to, e.distance]
            );
            edgeCount += res.rowCount;
        }

        const { rows: [{ count: hospitalRows }] } = await client.query("SELECT COUNT(*)::int AS count FROM hospitals");
        let hospitalCount = 0;
        if (hospitalRows === 0) {
            for (const h of nodes.filter((n) => n.type === "hospital")) {
                const beds = Math.max(0, Number(h.capacity) || 0);
                await client.query(
                    `INSERT INTO hospitals (name, latitude, longitude, total_beds, available_beds, node_id)
                     VALUES ($1, $2, $3, $4, $4, $5)`,
                    [h.name || h.id, h.lat, h.lng, beds, h.id]
                );
                hospitalCount++;
            }
        }

        const { rows: [{ count: ambulanceRows }] } = await client.query("SELECT COUNT(*)::int AS count FROM ambulances");
        let ambulanceCount = 0;
        if (ambulanceRows === 0) {
            for (const a of nodes.filter((n) => n.type === "ambulance")) {
                const status = a.status === "busy" ? "busy" : "available";
                await client.query(
                    `INSERT INTO ambulances (name, latitude, longitude, status, node_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [a.name || a.id, a.lat, a.lng, status, a.id]
                );
                ambulanceCount++;
            }
        }

        await client.query("COMMIT");
        console.log(`Seeded: ${nodes.length} nodes, ${edgeCount} new edges, ` +
            `${hospitalCount} hospitals${hospitalRows ? " (skipped, table not empty)" : ""}, ` +
            `${ambulanceCount} ambulances${ambulanceRows ? " (skipped, table not empty)" : ""}.`);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`Seed FAILED: ${error.message}`);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error(`Seed FAILED: ${error.message || error.code}`);
    process.exit(1);
});
