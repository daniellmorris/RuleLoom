export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LoggerFn = (...args: unknown[]) => void;
export interface RuleLoomLogger {
    level: LogLevel;
    trace: LoggerFn;
    debug: LoggerFn;
    info: LoggerFn;
    warn: LoggerFn;
    error: LoggerFn;
    fatal: LoggerFn;
}
export declare function createLogger(level?: LogLevel): RuleLoomLogger;
export {};
//# sourceMappingURL=logger.d.ts.map