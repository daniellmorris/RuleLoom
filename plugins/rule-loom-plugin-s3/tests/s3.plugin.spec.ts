import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('@aws-sdk/client-s3', () => {
  const send = vi.fn(async () => ({ ok: true }));
  const S3Client = vi.fn().mockImplementation(() => ({ send }));
  const PutObjectCommand = vi.fn();
  const GetObjectCommand = vi.fn();
  return { S3Client, PutObjectCommand, GetObjectCommand };
});

vi.mock('@aws-sdk/s3-request-presigner', () => {
  return { getSignedUrl: vi.fn(async () => 'https://example.com/presigned') };
});

describe('rule-loom-plugin-s3', () => {
  it('registers closures', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(2);
    expect(registerClosure.mock.calls[0][0].name).toBe('s3.putObject');
    expect(registerClosure.mock.calls[1][0].name).toBe('s3.getPresignedUrl');
  });
});
