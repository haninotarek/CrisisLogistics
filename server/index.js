const env = require("./config/env"); // loads server/.env first
const express = require("express");
const cors = require("cors");

const db = require("./config/database");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const reportsRoutes = require("./routes/reports");
const ambulancesRoutes = require("./routes/ambulances");
const hospitalsRoutes = require("./routes/hospitals");
const graphRoutes = require("./routes/graph");
const dispatchRoutes = require("./routes/dispatch");
const { getStats } = require("./controllers/dispatchController");

const app = express();

// ---------- Middleware ----------
app.disable("x-powered-by");
app.use(cors({ origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "100kb" }));

if (!env.isProduction) {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
        });
        next();
    });
}

// ---------- Health ----------
app.get("/", (req, res) => {
    res.json({ success: true, message: "Crisis Logistics API is running" });
});

// Always answers (200 or 503) - never throws, even if the DB is down.
const health = async (req, res) => {
    try {
        const time = await db.checkConnection();
        res.json({ success: true, database: "connected", time });
    } catch (error) {
        res.status(503).json({ success: false, database: "unavailable", message: error.message || error.code });
    }
};
app.get("/api/health", health);
app.get("/api/db-test", health); // kept for backwards compatibility

// ---------- API ----------
app.use("/api/reports", reportsRoutes);
app.use("/api/ambulances", ambulancesRoutes);
app.use("/api/hospitals", hospitalsRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.get("/api/stats", getStats);

// ---------- Errors (must be last) ----------
app.use(notFound);
app.use(errorHandler);

// ---------- Start ----------
const server = app.listen(env.PORT, async () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    try {
        await db.checkConnection();
        console.log("PostgreSQL connected");
    } catch (error) {
        // Keep the server up - requests will get a clear 503 until the DB is reachable.
        console.error(`PostgreSQL NOT reachable (${error.message || error.code}). Check DATABASE_URL in server/.env`);
    }
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${env.PORT} is already in use. Stop the other process or set PORT in server/.env`);
    } else {
        console.error("Server error:", error);
    }
    process.exit(1);
});

// ---------- Safety nets ----------
process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (error) => {
    console.error("[uncaughtException]", error);
    shutdown("uncaughtException", 1);
});

let shuttingDown = false;
function shutdown(signal, code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    const force = setTimeout(() => process.exit(code), 10000);
    force.unref();
    server.close(() => {
        db.pool.end().finally(() => process.exit(code));
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
