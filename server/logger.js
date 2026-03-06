/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Logger structuré (Pino)
 * ═══════════════════════════════════════════════════════════════
 */
const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
  base: { app: config.APP_NAME, version: config.APP_VERSION },
});

module.exports = logger;
