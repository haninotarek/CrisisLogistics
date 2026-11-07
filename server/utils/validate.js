const AppError = require("./AppError");

/**
 * Tiny dependency-free validator.
 *
 * schema = {
 *   field: { type: "string" | "integer" | "number" | "boolean",
 *            required, min, max, maxLength, enum, nullable }
 * }
 *
 * - Unknown fields are dropped (prevents writing arbitrary columns).
 * - Numeric strings ("12") and boolean strings ("true") are converted.
 * - partial = true  -> used for PATCH: only provided fields are validated, nothing is required.
 * Throws AppError(400) listing every invalid field.
 */
function validate(body, schema, { partial = false } = {}) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw AppError.badRequest("Request body must be a JSON object");
    }

    const errors = [];
    const out = {};

    for (const [field, rule] of Object.entries(schema)) {
        let value = body[field];
        if (typeof value === "string") value = value.trim();

        const missing = value === undefined || value === null || value === "";

        if (missing) {
            if (rule.required && !partial) {
                errors.push(`${field} is required`);
            } else if (body[field] !== undefined && (rule.nullable ?? !rule.required)) {
                out[field] = null; // explicitly cleared
            } else if (body[field] !== undefined) {
                errors.push(`${field} cannot be empty`);
            }
            continue;
        }

        switch (rule.type) {
            case "string":
                if (typeof value !== "string") value = String(value);
                if (rule.maxLength && value.length > rule.maxLength) {
                    errors.push(`${field} must be at most ${rule.maxLength} characters`);
                    continue;
                }
                break;

            case "integer":
            case "number": {
                const n = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(n) || typeof value === "boolean") {
                    errors.push(`${field} must be a number`);
                    continue;
                }
                if (rule.type === "integer" && !Number.isInteger(n)) {
                    errors.push(`${field} must be an integer`);
                    continue;
                }
                if (rule.min !== undefined && n < rule.min) {
                    errors.push(`${field} must be >= ${rule.min}`);
                    continue;
                }
                if (rule.max !== undefined && n > rule.max) {
                    errors.push(`${field} must be <= ${rule.max}`);
                    continue;
                }
                value = n;
                break;
            }

            case "boolean":
                if (value === true || value === "true" || value === 1 || value === "1") value = true;
                else if (value === false || value === "false" || value === 0 || value === "0") value = false;
                else {
                    errors.push(`${field} must be true or false`);
                    continue;
                }
                break;

            default:
                break;
        }

        if (rule.enum) {
            const match = rule.enum.find(
                (option) => String(option).toLowerCase() === String(value).toLowerCase()
            );
            if (match === undefined) {
                errors.push(`${field} must be one of: ${rule.enum.join(", ")}`);
                continue;
            }
            value = match; // normalise casing, e.g. "critical" -> "Critical"
        }

        out[field] = value;
    }

    if (errors.length > 0) {
        throw AppError.badRequest("Validation failed", errors);
    }
    if (partial && Object.keys(out).length === 0) {
        throw AppError.badRequest(`No valid fields to update. Allowed: ${Object.keys(schema).join(", ")}`);
    }
    return out;
}

/** Parses a positive integer route param like /:id, throwing 400 if invalid. */
function parseId(value, name = "id") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 2147483647) {
        throw AppError.badRequest(`${name} must be a positive integer`);
    }
    return n;
}

/** Reads ?limit=&offset= with safe bounds. */
function parsePagination(query, { defaultLimit = 100, maxLimit = 500 } = {}) {
    let limit = Number(query.limit);
    let offset = Number(query.offset);
    if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;
    if (!Number.isInteger(offset) || offset < 0) offset = 0;
    return { limit, offset };
}

module.exports = { validate, parseId, parsePagination };
