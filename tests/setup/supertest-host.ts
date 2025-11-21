import http from 'node:http';
import https from 'node:https';
import Test from 'supertest/lib/test.js';

const originalServerAddress = Test.prototype.serverAddress;

// Prefer binding ephemeral servers on 127.0.0.1; if that fails, fall back to
// supertest's default behaviour so tests can still run on permissive hosts.
Test.prototype.serverAddress = function serverAddress(app: http.Server, path: string) {
  try {
    if (!app.address()) {
      this._server = app.listen(0, '127.0.0.1');
    }
    const server = this._server ?? app;
    const resolved = server.address();
    if (resolved && typeof resolved !== 'string') {
      const port = resolved.port;
      const protocol = app instanceof https.Server ? 'https' : 'http';
      return `${protocol}://127.0.0.1:${port}${path}`;
    }
  } catch (err) {
    // fall through to default
  }

  return originalServerAddress.call(this, app, path);
};
