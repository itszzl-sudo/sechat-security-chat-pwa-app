import winston from "winston";
import path from "path";
import fs from "fs";

let _logger: winston.Logger | null = null;

/**
 * Initialize the application-wide logger. Call once at startup.
 */
export function initLogger(logLevel: string, logFile: string): winston.Logger {
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  _logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr =
          Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
        const stackStr = stack ? `\n${stack}` : "";
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}${stackStr}`;
      }),
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "HH:mm:ss" }),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            const stackStr = stack ? `\n${stack}` : "";
            return `${level} ${timestamp} ${message}${stackStr}`;
          }),
        ),
      }),
      new winston.transports.File({
        filename: logFile,
        maxsize: 10 * 1024 * 1024, // 10 MB
        maxFiles: 5,
        tailable: true,
      }),
    ],
  });

  _logger.info(`Logger initialized (level=${logLevel}, file=${logFile})`);
  return _logger;
}

/**
 * Get the application logger. Must call initLogger() first, otherwise
 * returns a default console-only logger.
 */
export function getLogger(): winston.Logger {
  if (!_logger) {
    _logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          const stackStr = stack ? `\n${stack}` : "";
          return `${level} ${timestamp} ${message}${stackStr}`;
        }),
      ),
      transports: [new winston.transports.Console()],
    });
  }
  return _logger;
}
