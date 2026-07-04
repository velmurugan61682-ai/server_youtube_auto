// logger.mjs — Production-grade Winston logger
// Fixes the "[object Object]" problem by serializing all non-string metadata.
import { createLogger, format, transports } from 'winston';

/**
 * Custom format: intercept every log entry and ensure any Error or Object
 * metadata is serialized to a readable string instead of "[object Object]".
 *
 * Winston's splat format only interpolates printf-style (%s, %d) tokens.
 * When code does `logger.error('msg:', err)` without %s, the Error
 * gets .toString()'d into "[object Object]". This transform fixes that
 * globally so we don't need to patch 50+ call sites.
 */
const serializeMetadata = format((info) => {
  // If 'message' itself is an object (rare, but happens with logger.error({ ... }))
  if (info.message && typeof info.message === 'object') {
    try {
      info.message = JSON.stringify(info.message, null, 2);
    } catch (_) {
      info.message = String(info.message);
    }
  }

  // Handle the common pattern: logger.error('prefix:', errorObj)
  // Winston puts extra args into info[Symbol.for('splat')]
  const splat = info[Symbol.for('splat')];
  if (splat && Array.isArray(splat) && splat.length > 0) {
    const serializedParts = splat.map((arg) => {
      if (arg instanceof Error) {
        return `${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
      }
      if (arg && typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (_) {
          return String(arg);
        }
      }
      return String(arg);
    });
    // Append serialized metadata to the message
    info.message = `${info.message} ${serializedParts.join(' ')}`;
  }

  // Also serialize the top-level 'error' field if it's an object (for structured logs)
  if (info.error && typeof info.error === 'object' && !(info.error instanceof Error)) {
    try {
      info.error = JSON.stringify(info.error, null, 2);
    } catch (_) {
      info.error = String(info.error);
    }
  }

  return info;
});

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.errors({ stack: true }),
    format.splat(),
    serializeMetadata(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: 'HH:mm:ss' }),
      format.printf(({ timestamp, level, message, stack }) => {
        const msg = stack || message;
        return `${timestamp} ${level}: ${msg}`;
      })
    )
  }));
}

export default logger;
