const db = require("./database");

/**
 * Detects optional parts of the schema at runtime, so the backend works both on the
 * current database (from the dump) and after the ERD upgrade (nodes / edges / incident_code).
 * Results are cached; call `reset()` after running a migration without restarting.
 */
let columns = null;
let tables = null;

async function load() {
    const [t, c] = await Promise.all([
        db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"),
        db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'")
    ]);
    tables = new Set(t.rows.map((r) => r.table_name));
    columns = new Set(c.rows.map((r) => `${r.table_name}.${r.column_name}`));
}

async function hasTable(name) {
    if (!tables) await load();
    return tables.has(name);
}

async function hasColumn(table, column) {
    if (!columns) await load();
    return columns.has(`${table}.${column}`);
}

function reset() {
    tables = null;
    columns = null;
}

module.exports = { hasTable, hasColumn, reset };
