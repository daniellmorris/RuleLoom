import http from 'node:http';

// Detect whether this environment allows binding to localhost. If not, mark a flag
// that tests can use to skip HTTP-bound integration cases.
async function checkBind(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => {
      try {
        server.close();
      } catch {}
      resolve(false);
    });
  });
}

(async () => {
  (globalThis as any).__HTTP_BIND_SUPPORTED__ = await checkBind();
})();
