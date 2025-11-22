const force = process.env.RULE_LOOM_FORCE_HTTP_TESTS === 'true';
const bindSupported = force || (globalThis as any).__HTTP_BIND_SUPPORTED__ !== false;

// Helper aliases to skip HTTP-bound tests when the environment disallows binding sockets.
export const describeHttp = bindSupported ? describe : describe.skip;
export const itHttp = bindSupported ? it : it.skip;
