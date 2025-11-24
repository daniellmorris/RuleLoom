import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

export const plugin = {
  name: 'rule-loom-plugin-s3',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 's3.putObject',
      description: 'Upload an object to S3/MinIO',
      signature: {
        parameters: [
          { name: 'region', type: 'string', required: true },
          { name: 'endpoint', type: 'string', required: false },
          { name: 'accessKeyId', type: 'string', required: true },
          { name: 'secretAccessKey', type: 'string', required: true },
          { name: 'bucket', type: 'string', required: true },
          { name: 'key', type: 'string', required: true },
          { name: 'body', type: 'any', required: true },
          { name: 'contentType', type: 'string', required: false }
        ],
      },
      handler: async (_state, { parameters }) => {
        const {
          region,
          endpoint,
          accessKeyId,
          secretAccessKey,
          bucket,
          key,
          body,
          contentType,
        } = parameters as any;
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const client = new S3Client({
          region,
          endpoint,
          forcePathStyle: !!endpoint,
          credentials: { accessKeyId, secretAccessKey },
        });
        const res = await client.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
        );
        return res;
      },
    });

    ctx.registerClosure({
      name: 's3.getPresignedUrl',
      description: 'Generate a presigned GET URL',
      signature: {
        parameters: [
          { name: 'region', type: 'string', required: true },
          { name: 'endpoint', type: 'string', required: false },
          { name: 'accessKeyId', type: 'string', required: true },
          { name: 'secretAccessKey', type: 'string', required: true },
          { name: 'bucket', type: 'string', required: true },
          { name: 'key', type: 'string', required: true },
          { name: 'expiresIn', type: 'number', required: false },
        ],
      },
      handler: async (_state, { parameters }) => {
        const {
          region,
          endpoint,
          accessKeyId,
          secretAccessKey,
          bucket,
          key,
          expiresIn = 900,
        } = parameters as any;
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const client = new S3Client({
          region,
          endpoint,
          forcePathStyle: !!endpoint,
          credentials: { accessKeyId, secretAccessKey },
        });
        const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
        return { url, expiresIn };
      },
    });
  },
};

export default plugin;
