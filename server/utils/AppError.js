class AppError extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        if (details !== undefined) this.details = details;
    }

    static badRequest(message, details) { return new AppError(400, message, details); }
    static notFound(message = "Resource not found") { return new AppError(404, message); }
    static conflict(message, details) { return new AppError(409, message, details); }
}

module.exports = AppError;
