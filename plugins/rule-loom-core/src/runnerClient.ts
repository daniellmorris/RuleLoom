export interface RunnerCallAuth {
  type?: 'bearer' | 'basic';
  token?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
}

export interface RunnerCallRequest {
  url?: string;
  host?: string;
  flow: string;
  state?: unknown;
  payload?: unknown;
  auth?: string | RunnerCallAuth;
  timeoutMs?: number;
  retries?: number;
  simulate?: boolean;
  trace?: boolean;
  allowedHosts?: string[];
  allowInsecureHttp?: boolean;
  requestId?: string;
  callDepth?: number;
  maxCallDepth?: number;
}

export interface RunnerCallResponse {
  flow?: string;
  state?: Record<string, unknown>;
  lastResult?: unknown;
  trace?: unknown[];
  [key: string]: unknown;
}

export async function callRuleLoomRunner(request: RunnerCallRequest): Promise<RunnerCallResponse> {
  const endpoint = resolveEndpoint(request);
  const timeoutMs = request.timeoutMs ?? 5000;
  const retries = Math.max(0, request.retries ?? 0);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await postRunnerCall(endpoint, request, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Runner call failed after ${retries + 1} attempt${retries === 0 ? '' : 's'}: ${reason}`);
}

function resolveEndpoint(request: RunnerCallRequest): string {
  const raw = request.url ?? request.host;
  if (!raw || typeof raw !== 'string') {
    throw new Error('core.runner-call requires "url" or "host".');
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('core.runner-call requires a non-empty "url" or "host".');
  }
  const endpoint = request.url ? trimmed : `${trimmed.replace(/\/+$/, '')}/__ruleloom/run`;
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Runner call protocol "${url.protocol}" is not supported.`);
  }
  if (url.username || url.password) {
    throw new Error('Runner call URLs cannot contain credentials. Use the auth parameter.');
  }
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol === 'http:' && !isLoopback && request.allowInsecureHttp !== true) {
    throw new Error('Runner calls require HTTPS unless allowInsecureHttp is enabled for a trusted host.');
  }
  if (request.allowedHosts?.length && !request.allowedHosts.includes(url.host) && !request.allowedHosts.includes(url.hostname)) {
    throw new Error(`Runner call host "${url.host}" is not allowed.`);
  }
  return url.toString();
}

async function postRunnerCall(endpoint: string, request: RunnerCallRequest, timeoutMs: number): Promise<RunnerCallResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(request),
      body: JSON.stringify({
        flow: request.flow,
        state: request.state,
        payload: request.payload,
        simulate: Boolean(request.simulate),
        trace: request.trace !== false,
      }),
      signal: controller.signal,
      redirect: 'error',
    });
    const body = await readResponseBody(res);
    if (!res.ok) {
      const message = responseErrorMessage(body) ?? `HTTP ${res.status}`;
      throw new Error(`Runner call to ${endpoint} failed: ${message}`);
    }
    if (!body || typeof body !== 'object') {
      throw new Error(`Runner call to ${endpoint} returned a non-object response.`);
    }
    return body as RunnerCallResponse;
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new Error(`Runner call to ${endpoint} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildHeaders(request: RunnerCallRequest): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const callDepth = Math.max(1, request.callDepth ?? 1);
  const maxCallDepth = Math.max(1, request.maxCallDepth ?? 8);
  if (callDepth > maxCallDepth) {
    throw new Error(`Runner call depth exceeds ${maxCallDepth}.`);
  }
  headers['x-ruleloom-call-depth'] = String(callDepth);
  if (request.requestId) headers['x-ruleloom-request-id'] = request.requestId;
  const auth = request.auth;
  if (!auth) return headers;
  if (typeof auth === 'string') {
    headers.authorization = `Bearer ${auth}`;
    return headers;
  }
  Object.assign(headers, auth.headers ?? {});
  if (auth.type === 'basic') {
    const username = auth.username ?? '';
    const password = auth.password ?? '';
    headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  } else if (auth.token) {
    headers.authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseErrorMessage(body: unknown): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const err = (body as any).error;
    if (typeof err === 'string') return err;
    if (typeof err?.message === 'string') return err.message;
    if (typeof (body as any).message === 'string') return (body as any).message;
  }
  return undefined;
}
