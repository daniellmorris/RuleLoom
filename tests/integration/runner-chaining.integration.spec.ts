import path from 'node:path';
import http from 'node:http';
import { describe, expect } from 'vitest';
import { itHttp } from '../helpers/httpSkip.ts';
import { createRunner } from '../../packages/rule-loom-runner/src/index.ts';
import { callRuleLoomRunner } from '../../plugins/rule-loom-core/src/runnerClient.ts';

const CONFIG_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'configs');

describe('Runner chaining', () => {
  itHttp('core.runner-call invokes a downstream runner, merges state, and records traces', async () => {
    const downstream = await createRunner(path.join(CONFIG_DIR, 'runner-chain-downstream.yaml'));
    const upstream = await createRunner(path.join(CONFIG_DIR, 'runner-chain-upstream.yaml'));
    try {
      const server = downstream.services.httpServer as http.Server;
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected downstream HTTP server address');
      const runnerHost = `http://127.0.0.1:${address.port}`;
      await expect(
        callRuleLoomRunner({ host: runnerHost, flow: 'downstream-flow', payload: { message: 'unauthorized' } }),
      ).rejects.toThrow(/Unauthorized/);
      const events: any[] = [];
      const result = await upstream.engine.execute(
        'upstream-flow',
        { runnerHost, message: 'hello-chain' },
        {
          recorder: { onEvent: (event) => events.push(event) },
          recordLevel: 'full',
        },
      );

      expect(result.state.response).toMatchObject({
        status: 200,
        body: {
          downstream: { ok: true, echoed: 'hello-chain' },
          merged: 'hello-chain',
        },
      });
      expect(Number((result.state.response as any).body.traceCount)).toBeGreaterThan(0);
      expect(events.some((event) => event.kind === 'exit' && event.step === 'runner-call' && event.output?.trace?.length > 0)).toBe(true);
    } finally {
      await upstream.close();
      await downstream.close();
    }
  });

  itHttp('runner client retries transient failures', async () => {
    let calls = 0;
    const server = await listen((req, res) => {
      calls += 1;
      if (calls === 1) {
        res.statusCode = 503;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: { message: 'try again' } }));
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ state: { ok: true }, lastResult: 'done', trace: [] }));
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected test server address');
      const result = await callRuleLoomRunner({
        host: `http://127.0.0.1:${address.port}`,
        flow: 'any-flow',
        payload: { ok: true },
        retries: 1,
        timeoutMs: 1000,
      });

      expect(calls).toBe(2);
      expect(result.lastResult).toBe('done');
    } finally {
      await close(server);
    }
  });

  itHttp('runner client reports timeouts clearly', async () => {
    const server = await listen((_req, _res) => {
      // Intentionally leave the request open until the client aborts.
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected test server address');
      await expect(
        callRuleLoomRunner({
          host: `http://127.0.0.1:${address.port}`,
          flow: 'any-flow',
          timeoutMs: 20,
        }),
      ).rejects.toThrow(/timed out|Runner call failed/);
    } finally {
      await close(server);
    }
  });

  itHttp('runner client enforces host and call-depth policy before sending', async () => {
    await expect(
      callRuleLoomRunner({
        host: 'http://example.com',
        flow: 'any-flow',
      }),
    ).rejects.toThrow(/HTTPS/);

    await expect(
      callRuleLoomRunner({
        host: 'https://runner.example.com',
        flow: 'any-flow',
        allowedHosts: ['different.example.com'],
      }),
    ).rejects.toThrow(/not allowed/);

    await expect(
      callRuleLoomRunner({
        host: 'http://127.0.0.1:1',
        flow: 'any-flow',
        callDepth: 9,
        maxCallDepth: 8,
      }),
    ).rejects.toThrow(/depth exceeds/);
  });
});

function listen(handler: http.RequestListener): Promise<http.Server> {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
