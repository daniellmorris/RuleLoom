export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type LoggerFn = (...args: unknown[]) => void;

const ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function createWriter(threshold: LogLevel, level: LogLevel, fn: LoggerFn): LoggerFn {
  return (...args: unknown[]) => {
    if (ORDER[level] < ORDER[threshold]) {
      return;
    }
    fn(...args);
  };
}

export interface TreeExeLogger {
  level: LogLevel;
  trace: LoggerFn;
  debug: LoggerFn;
  info: LoggerFn;
  warn: LoggerFn;
  error: LoggerFn;
  fatal: LoggerFn;
}

export function createLogger(level: LogLevel = 'info'): TreeExeLogger {
  const normalized = ORDER[level] ? level : 'info';

  return {
    level: normalized,
    trace: createWriter(normalized, 'trace', console.debug.bind(console)),
    debug: createWriter(normalized, 'debug', console.debug.bind(console)),
    info: createWriter(normalized, 'info', console.info.bind(console)),
    warn: createWriter(normalized, 'warn', console.warn.bind(console)),
    error: createWriter(normalized, 'error', console.error.bind(console)),
    fatal: createWriter(normalized, 'fatal', console.error.bind(console)),
  };
}
