import { describe, expect, it, vi } from 'vitest';
import { inferDashboardSourceType, loadDashboardData } from './dashboardDataSource';

describe('dashboard data sources', () => {
  it('keeps legacy endpoint configurations working', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 1 }]));

    await expect(loadDashboardData({ endpoint: '/api/items' }, fetcher)).resolves.toEqual([{ id: 1 }]);
    expect(inferDashboardSourceType({ endpoint: '/api/items' })).toBe('endpoint');
    expect(fetcher).toHaveBeenCalledWith('/api/items', undefined);
  });

  it('executes a flow and uses its response body by default', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      flow: 'inventory.list',
      state: { response: { status: 200, body: [{ sku: 'A-1' }] } },
      lastResult: { status: 200, body: [{ sku: 'A-1' }] },
    }));

    await expect(loadDashboardData({
      sourceType: 'flow',
      flowName: 'inventory.list',
      flowState: '{"tenant":"north"}',
    }, fetcher)).resolves.toEqual([{ sku: 'A-1' }]);

    expect(fetcher).toHaveBeenCalledWith('/__ruleloom/run', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ flow: 'inventory.list', state: { tenant: 'north' }, trace: false }),
    }));
  });

  it('supports an explicit path in the flow execution envelope', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ state: { report: { rows: [{ ok: true }] } } }));

    await expect(loadDashboardData({
      sourceType: 'flow',
      flowName: 'report',
      resultPath: 'state.report.rows',
    }, fetcher)).resolves.toEqual([{ ok: true }]);
  });

  it('reports invalid flow configuration and response paths', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ state: {} }));

    await expect(loadDashboardData({ sourceType: 'flow' }, fetcher)).rejects.toThrow(/requires a flow/);
    await expect(loadDashboardData({
      sourceType: 'flow',
      flowName: 'report',
      resultPath: 'state.missing',
    }, fetcher)).rejects.toThrow(/was not found/);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}
