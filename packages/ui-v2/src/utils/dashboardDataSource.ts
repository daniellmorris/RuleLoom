export type DashboardSourceType = 'static' | 'endpoint' | 'flow';

export interface DashboardDataSourceConfig {
  sourceType?: DashboardSourceType;
  data?: unknown;
  endpoint?: string;
  flowName?: string;
  flowEndpoint?: string;
  flowState?: unknown;
  resultPath?: string;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function inferDashboardSourceType(config: DashboardDataSourceConfig): DashboardSourceType {
  if (config.sourceType) return config.sourceType;
  if (config.flowName) return 'flow';
  if (config.endpoint) return 'endpoint';
  return 'static';
}

export async function loadDashboardData(
  config: DashboardDataSourceConfig,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const sourceType = inferDashboardSourceType(config);
  if (sourceType === 'static') return config.data;

  if (sourceType === 'endpoint') {
    if (!config.endpoint?.trim()) throw new Error('Dashboard endpoint source requires an endpoint URL.');
    return requestJson(fetchImpl, config.endpoint.trim());
  }

  const flowName = config.flowName?.trim();
  if (!flowName) throw new Error('Dashboard flow source requires a flow.');
  const state = parseFlowState(config.flowState);
  const response = await requestJson(fetchImpl, config.flowEndpoint?.trim() || '/__ruleloom/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ flow: flowName, state, trace: false }),
  });

  if (config.resultPath?.trim()) {
    const selected = getPath(response, config.resultPath.trim());
    if (selected === undefined) {
      throw new Error(`Flow response path "${config.resultPath.trim()}" was not found.`);
    }
    return selected;
  }

  return firstDefined(
    getPath(response, 'state.response.body'),
    getPath(response, 'lastResult.body'),
    getPath(response, 'lastResult'),
    getPath(response, 'state'),
  );
}

async function requestJson(fetchImpl: FetchLike, url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = getPath(body, 'error.message') ?? getPath(body, 'message') ?? response.statusText;
    throw new Error(`Dashboard data request failed (${response.status}): ${String(message || 'Unknown error')}`);
  }
  return body;
}

function parseFlowState(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || value === '') return {};
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Dashboard flow initial state must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function getPath(value: unknown, path: string): unknown {
  const segments = path.match(/[^.[\]]+/g) ?? [];
  return segments.reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    if (['__proto__', 'prototype', 'constructor'].includes(segment)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined);
}
