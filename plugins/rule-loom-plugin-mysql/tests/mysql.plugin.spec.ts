import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('mysql2/promise', () => {
  const execute = vi.fn(async () => [[{ id: 1 }], []]);
  const end = vi.fn();
  const createConnection = vi.fn(async () => ({ execute, end }));
  return { createConnection };
});

describe('rule-loom-plugin-mysql', () => {
  it('registers mysql.query', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(1);
    expect(registerClosure.mock.calls[0][0].name).toBe('mysql.query');
  });
});
