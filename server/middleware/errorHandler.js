const AppError = require("../utils/AppError");
const env = require("../config/env");

// PostgreSQL error codes -> HTTP responses
const PG_ERRORS = {
    "23505": [409, "Duplicate value - this record already exists"],
    "23503": [409, "Operation violates a relation (referenced record missing or still in use)"],
    "23514": [400, "Value violates a database rule (check constraint)"],
    "23502": [400, "A required field is missing"],
    "22P02": [400, "Invalid value format"],
    "22003": [400, "Numeric value out of range"],
    "22001": [400, "Value too long"],
    "42P01": [500, "Database table missing - run `npm run db:init`"],
    "42703": [500, "Database column missing - run `npm run db:init`"]
};

const DB_DOWN_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "57P01", "57P03", "28P01", "3D000"]);

function notFound(req, res) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    let status = 500;
    let message = "Internal server error";
    let details;

    if (err instanceof AppError) {
        status = err.statusCode;
        message = err.message;
        details = err.details;
    } else if (err.type === "entity.parse.failed") {
        status = 400;
        message = "Malformed JSON in request body";
    } else if (err.type === "entity.too.large") {
        status = 413;
        message = "Request body too large";
    } else if (err.code && PG_ERRORS[err.code]) {
        [status, message] = PG_ERRORS[err.code];
        details = err.detail || err.constraint || undefined;
    } else if (DB_DOWN_CODES.has(err.code)
               || /ECONNREFUSED|Connection terminated|timeout exceeded when trying to connect/i.test(err.message || "")) {
        status = 503;
        message = "Database is unavailable, please try again shortly";
    } else if (Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
        status = err.status;
        message = err.expose ? err.message : message;
    }

    if (status >= 500) {
        console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);
    }

    const body = { success: false, message };
    if (details !== undefined) body.details = details;
    if (!env.isProduction && status >= 500 && !(err instanceof AppError)) body.error = err.message;

    res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
