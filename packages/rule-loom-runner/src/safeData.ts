const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export interface SafeDataLimits {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
}

export function assertSafeData(value: unknown, label = 'data', limits: SafeDataLimits = {}): void {
  const maxDepth = limits.maxDepth ?? 100;
  const maxNodes = limits.maxNodes ?? 100_000;
  const seen = new WeakSet<object>();
  let nodes = 0;

  const visit = (current: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > maxNodes) throw new Error(`${label} exceeds the maximum node count (${maxNodes}).`);
    if (depth > maxDepth) throw new Error(`${label} exceeds the maximum nesting depth (${maxDepth}).`);
    if (!current || typeof current !== 'object') return;
    if (seen.has(current)) return;
    seen.add(current);
    for (const key of Object.keys(current)) {
      if (BLOCKED_KEYS.has(key)) throw new Error(`${label} contains blocked key "${key}".`);
      visit((current as Record<string, unknown>)[key], depth + 1);
    }
  };

  visit(value, 0);
}

export function assertTextSize(text: string, label = 'data', maxBytes = 2 * 1024 * 1024): void {
  const size = Buffer.byteLength(text, 'utf8');
  if (size > maxBytes) throw new Error(`${label} exceeds the maximum size (${maxBytes} bytes).`);
}
