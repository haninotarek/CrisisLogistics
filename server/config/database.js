const { Pool, types } = require("pg");
const env = require("./env");

// Return NUMERIC / BIGINT as JS numbers instead of strings (lat/lng, distances, COUNT(*)).
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));
types.setTypeParser(20, (value) => (value === null ? null : parseInt(value, 10)));

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// An idle client erroring (e.g. DB restarted) must NOT crash the process.
pool.on("error", (error) => {
    console.error("[db] Idle client error:", error.message);
});

const query = (text, params) => pool.query(text, params);

/**
 * Runs `fn(client)` inside a transaction. Commits on success, rolls back on any error.
 */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function checkConnection() {
    const result = await pool.query("SELECT NOW() AS now");
    return result.rows[0].now;
}

// Plain object (not the pool itself) so we don't overwrite pool.query.
// `db.query(...)` works exactly like the old `pool.query(...)`.
module.exports = { pool, query, withTransaction, checkConnection };
