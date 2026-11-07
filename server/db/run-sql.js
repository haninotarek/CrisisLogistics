/**
 * Runs one or more .sql files from server/db against DATABASE_URL.
 * Usage:  node server/db/run-sql.js schema.sql [seed.sql ...]
 * (no psql needed)
 */
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");

async function main() {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.error("Usage: node server/db/run-sql.js <file.sql> [more.sql ...]");
        process.exit(1);
    }

    let client;
    try {
        client = await pool.connect();
    } catch (error) {
        console.error(`Cannot connect to the database (${error.message || error.code}). Check DATABASE_URL in server/.env`);
        await pool.end().catch(() => {});
        process.exit(1);
    }
    client.on("notice", (msg) => console.log(`  NOTICE: ${msg.message}`));

    try {
        for (const file of files) {
            const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, file);
            const sql = fs.readFileSync(fullPath, "utf8");
            console.log(`Running ${path.basename(fullPath)} ...`);
            await client.query("BEGIN");
            await client.query(sql);
            await client.query("COMMIT");
            console.log(`  done.`);
        }
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`  FAILED: ${error.message}`);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
