const ORDER = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
};
function createWriter(threshold, level, fn) {
    return (...args) => {
        if (ORDER[level] < ORDER[threshold]) {
            return;
        }
        fn(...args);
    };
}
export function createLogger(level = 'info') {
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
//# sourceMappingURL=logger.js.map