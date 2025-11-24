import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('pg', () => {
  const connect = vi.fn();
  const end = vi.fn();
  const query = vi.fn(async () => ({ rows: [{ id: 1 }], rowCount: 1 }));
  const Client = vi.fn().mockImplementation(() => ({ connect, end, query }));
  return { Client };
});

describe('rule-loom-plugin-postgres', () => {
  it('registers postgres.query', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(1);
    expect(registerClosure.mock.calls[0][0].name).toBe('postgres.query');
  });
});
