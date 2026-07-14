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
  if (request.url) return trimmed;
  return `${trimmed.replace(/\/+$/, '')}/__ruleloom/run`;
}

async function postRunnerCall(endpoint: string, request: RunnerCallRequest, timeoutMs: number): Promise<RunnerCallResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(request.auth),
      body: JSON.stringify({
        flow: request.flow,
        state: request.state,
        payload: request.payload,
        simulate: Boolean(request.simulate),
        trace: request.trace !== false,
      }),
      signal: controller.signal,
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

function buildHeaders(auth?: string | RunnerCallAuth): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
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
