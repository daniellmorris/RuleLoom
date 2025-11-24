function resolveFetch() {
    const nativeFetch = globalThis.fetch;
    if (typeof nativeFetch === 'function') {
        return nativeFetch.bind(globalThis);
    }
    throw new Error('Global fetch is not available. Run on Node.js 18+ or provide a polyfill.');
}
function normalizeHeaders(...headerSets) {
    const headers = {};
    for (const set of headerSets) {
        if (!set)
            continue;
        for (const [key, value] of Object.entries(set)) {
            if (value === undefined || value === null)
                continue;
            headers[key] = String(value);
        }
    }
    return headers;
}
function buildUrl(baseUrl, providedUrl) {
    if (!providedUrl) {
        throw new Error('http.request requires a "url" parameter or default.');
    }
    if (!baseUrl) {
        try {
            return new URL(providedUrl).toString();
        }
        catch (error) {
            if (providedUrl.startsWith('http://') || providedUrl.startsWith('https://')) {
                throw error;
            }
            throw new Error(`Invalid URL "${providedUrl}" and no baseUrl configured.`);
        }
    }
    try {
        return new URL(providedUrl, baseUrl).toString();
    }
    catch (error) {
        throw new Error(`Failed to resolve URL "${providedUrl}" with base "${baseUrl}": ${error instanceof Error ? error.message : String(error)}`);
    }
}
function isJsonContentType(contentType) {
    if (!contentType)
        return false;
    return contentType.toLowerCase().includes('application/json');
}
function coerceString(value) {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    return undefined;
}
function coerceHeaders(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const headers = {};
    for (const [key, rawValue] of Object.entries(value)) {
        if (rawValue === undefined || rawValue === null)
            continue;
        headers[key] = String(rawValue);
    }
    return headers;
}
function coerceTimeout(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length) {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return undefined;
}
export function createHttpClosures(options = {}) {
    const closureName = options.name ?? 'http.request';
    const closureDescription = options.description ?? 'Performs an HTTP request and returns status, headers, and body.';
    return [
        {
            name: closureName,
            description: closureDescription,
            handler: async (_state, context) => {
                const params = (context.parameters ?? {});
                const methodParam = coerceString(params.method);
                const baseUrl = coerceString(params.baseUrl) ?? options.baseUrl;
                const providedUrl = coerceString(params.url) ?? options.url;
                const optionTimeout = coerceTimeout(options.timeoutMs);
                const timeoutSource = coerceTimeout(params.timeoutMs) ?? optionTimeout ?? 30000;
                let timeoutMs = Number(timeoutSource);
                if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
                    timeoutMs = 30000;
                }
                const headers = normalizeHeaders(options.headers, coerceHeaders(params.headers));
                const bodyInput = params.body ?? options.body;
                const url = buildUrl(baseUrl, providedUrl);
                const fetchImpl = resolveFetch();
                const method = (methodParam ?? options.method ?? 'GET').toUpperCase();
                const requestInit = {
                    method,
                    headers,
                };
                if (bodyInput !== undefined && bodyInput !== null) {
                    if (typeof bodyInput === 'string' || bodyInput instanceof ArrayBuffer || ArrayBuffer.isView(bodyInput)) {
                        requestInit.body = bodyInput;
                    }
                    else {
                        requestInit.body = JSON.stringify(bodyInput);
                        if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
                            headers['Content-Type'] = 'application/json';
                        }
                    }
                }
                const controller = new AbortController();
                requestInit.signal = controller.signal;
                let timeoutHandle;
                if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
                    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
                }
                try {
                    const response = await fetchImpl(url, requestInit);
                    const rawBody = await response.text();
                    const headerEntries = response.headers && typeof response.headers.entries === 'function' ? Array.from(response.headers.entries()) : [];
                    const responseHeaders = Object.fromEntries(headerEntries);
                    let parsedBody = rawBody;
                    const contentType = responseHeaders['content-type'] ?? response.headers?.get?.('content-type');
                    if (rawBody && isJsonContentType(contentType)) {
                        parsedBody = JSON.parse(rawBody);
                    }
                    if (!response.ok) {
                        const error = new Error(`Request to ${url} failed with status ${response.status}`);
                        error.status = response.status;
                        error.body = parsedBody;
                        throw error;
                    }
                    return {
                        status: response.status,
                        headers: responseHeaders,
                        body: parsedBody,
                    };
                }
                catch (error) {
                    if (error?.name === 'AbortError') {
                        throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
                    }
                    throw error;
                }
                finally {
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }
                }
            },
            signature: {
                description: closureDescription,
                parameters: [
                    { name: 'method', type: 'string', description: 'HTTP method (GET/POST/etc.).' },
                    {
                        name: 'url',
                        type: 'string',
                        description: 'Absolute URL or path relative to baseUrl.',
                        required: !options.url,
                    },
                    { name: 'baseUrl', type: 'string', description: 'Override base URL for this invocation.' },
                    { name: 'headers', type: 'object', description: 'Additional request headers.' },
                    { name: 'body', type: 'any', description: 'JSON-serializable payload or raw string.' },
                    { name: 'timeoutMs', type: 'number', description: 'Request timeout in milliseconds.' },
                ],
                allowAdditionalParameters: false,
                returns: { type: 'object', description: 'Response { status, headers, body }.' },
            },
        },
    ];
}
//# sourceMappingURL=http.js.map