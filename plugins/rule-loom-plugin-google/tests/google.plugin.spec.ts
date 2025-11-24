import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('googleapis', () => {
  const append = vi.fn(async () => ({ data: { updatedRows: 1 } }));
  const sheets = vi.fn(() => ({ spreadsheets: { values: { append } } }));
  const google = { sheets, auth: { JWT: vi.fn(() => ({})) } };
  return { google };
});

vi.mock('@google-cloud/storage', () => {
  const save = vi.fn(async () => {});
  const getSignedUrl = vi.fn(async () => ['https://example.com/file']);
  const file = vi.fn(() => ({ save, getSignedUrl }));
  const bucket = vi.fn(() => ({ file }));
  const Storage = vi.fn(() => ({ bucket }));
  return { Storage };
});

describe('rule-loom-plugin-google', () => {
  it('registers google sheets, drive, gmail closures', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(3);
    expect(registerClosure.mock.calls[0][0].name).toBe('google.sheets.append');
    expect(registerClosure.mock.calls[1][0].name).toBe('google.drive.upload');
    expect(registerClosure.mock.calls[2][0].name).toBe('google.gmail.send');
  });
});
