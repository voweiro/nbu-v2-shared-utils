/**
 * @nbu/shared-utils
 * ─────────────────
 * Central export for all shared utilities.
 * Each microservice imports what it needs:
 *
 *   const { authMiddleware, errorMiddleware, createRedisClient, publishEvent } = require('@nbu/shared-utils');
 */

const authMiddleware  = require('./middleware/authMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');
const {
    createRedisClient,
    createEventPublisher,
} = require('./utils/redisClient');

module.exports = {
    authMiddleware,
    errorMiddleware,
    createRedisClient,
    createEventPublisher,
};
