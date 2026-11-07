const path = require("path");

// Always load server/.env, no matter which folder the app is started from.
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const env = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: toNumber(process.env.PORT, 4000),
    DATABASE_URL: process.env.DATABASE_URL,
    AI_URL: (process.env.AI_URL || "").replace(/\/+$/, ""),
    AI_TIMEOUT_MS: toNumber(process.env.AI_TIMEOUT_MS, 3000),
    AVG_SPEED_KMH: toNumber(process.env.AVG_SPEED_KMH, 40),
    CORS_ORIGIN: process.env.CORS_ORIGIN || "*"
};

env.isProduction = env.NODE_ENV === "production";

if (!env.DATABASE_URL) {
    console.warn("[config] DATABASE_URL is not set in server/.env - database calls will fail.");
}

module.exports = env;
