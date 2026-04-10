/**
 * shared-utils/middleware/errorMiddleware.js
 * ───────────────────────────────────────────
 * Unified global error handler for all NBU-Net microservices.
 *
 * Safety rules:
 *  • 5xx errors → generic message in production (no Prisma/DB internals)
 *  • 4xx errors → pass through err.message (these are safe, intentional errors)
 *  • Stack traces only visible in development
 *
 * Prisma-specific error codes are mapped to human-readable messages.
 *
 * Usage in any service's app.js (MUST be registered AFTER all routes):
 *   const { errorMiddleware } = require('@nbu/shared-utils');
 *   app.use(errorMiddleware);
 */

const PRISMA_ERROR_MAP = {
    P2002: (err) => {
        const field = err.meta?.target?.[0] || 'field';
        return { status: 409, message: `A record with this ${field} already exists.` };
    },
    P2025: () => ({ status: 404, message: 'The requested record was not found.' }),
    P2003: () => ({ status: 400, message: 'A related record does not exist.' }),
    P2016: () => ({ status: 400, message: 'Invalid query argument provided.' }),
};

const errorMiddleware = (err, req, res, next) => {
    // Always log the full error server-side for observability
    console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.originalUrl}:`, err);

    const isProd = process.env.NODE_ENV === 'production';

    // ── Prisma-specific handling ──────────────────────────────────────────────
    if (err.code && PRISMA_ERROR_MAP[err.code]) {
        const mapped = PRISMA_ERROR_MAP[err.code](err);
        return res.status(mapped.status).json({
            message: mapped.message,
            error: isProd ? undefined : err.message,
        });
    }

    // ── Explicit status codes (4xx are intentional, safe to expose) ───────────
    const status = err.status || err.statusCode || 500;
    const is5xx  = status >= 500;

    return res.status(status).json({
        message: (isProd && is5xx) ? 'An internal server error occurred.' : (err.message || 'An error occurred.'),
        error:   isProd ? undefined : err.stack,
    });
};

module.exports = errorMiddleware;
