import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('@notionhq/client', () => {
  const create = vi.fn(async () => ({ id: 'page_1' }));
  const query = vi.fn(async () => ({ results: [] }));
  const Client = vi.fn().mockImplementation(() => ({ pages: { create }, databases: { query } }));
  return { Client };
});

describe('rule-loom-plugin-notion', () => {
  it('registers Notion closures', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(2);
    expect(registerClosure.mock.calls[0][0].name).toBe('notion.createPage');
    expect(registerClosure.mock.calls[1][0].name).toBe('notion.queryDatabase');
  });
});
