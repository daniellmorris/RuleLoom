import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';
import { google } from 'googleapis';

type SheetsAppendParams = {
  serviceAccount: { client_email: string; private_key: string };
  spreadsheetId: string;
  range: string;
  values: unknown[][];
};

type DriveUploadParams = {
  serviceAccount: { client_email: string; private_key: string };
  bucket?: string;
  filename: string;
  contentType?: string;
  buffer: Buffer | Uint8Array | string;
};

type GmailSendParams = {
  serviceAccount: { client_email: string; private_key: string };
  user: string;
  to: string;
  subject: string;
  body: string;
};

export const plugin = {
  name: 'rule-loom-plugin-google',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 'google.sheets.append',
      description: 'Append rows to a Google Sheet',
      signature: {
        parameters: [
          { name: 'serviceAccount', type: 'object', required: true },
          { name: 'spreadsheetId', type: 'string', required: true },
          { name: 'range', type: 'string', required: true },
          { name: 'values', type: 'array', required: true },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { serviceAccount, spreadsheetId, range, values } = parameters as SheetsAppendParams;
        const auth = new google.auth.JWT({
          email: serviceAccount.client_email,
          key: serviceAccount.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values },
        });
        return res.data;
      },
    });

    ctx.registerClosure({
      name: 'google.drive.upload',
      description: 'Upload a file to Google Drive (or GCS via storage)',
      signature: {
        parameters: [
          { name: 'serviceAccount', type: 'object', required: true },
          { name: 'bucket', type: 'string', required: false },
          { name: 'filename', type: 'string', required: true },
          { name: 'contentType', type: 'string', required: false },
          { name: 'buffer', type: 'any', required: true },
        ],
      },
      handler: async (_state, { parameters, runtime }) => {
        const { Storage } = await import('@google-cloud/storage');
        const { serviceAccount, bucket = 'default', filename, contentType, buffer } = parameters as DriveUploadParams;
        const storage = new Storage({
          credentials: serviceAccount,
        });
        const b = storage.bucket(bucket);
        const file = b.file(filename);
        await file.save(buffer, { contentType });
        const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 3600_000 });
        runtime.logger?.info?.('Uploaded to GCS', { bucket, filename });
        return { bucket, filename, url };
      },
    });

    ctx.registerClosure({
      name: 'google.gmail.send',
      description: 'Send an email via Gmail API using service account (domain-wide delegation)',
      signature: {
        parameters: [
          { name: 'serviceAccount', type: 'object', required: true },
          { name: 'user', type: 'string', required: true },
          { name: 'to', type: 'string', required: true },
          { name: 'subject', type: 'string', required: true },
          { name: 'body', type: 'string', required: true },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { serviceAccount, user, to, subject, body } = parameters as GmailSendParams;
        const auth = new google.auth.JWT({
          email: serviceAccount.client_email,
          key: serviceAccount.private_key,
          scopes: ['https://www.googleapis.com/auth/gmail.send'],
          subject: user,
        });
        const gmail = google.gmail({ version: 'v1', auth });
        const message = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset="UTF-8"',
          '',
          body,
        ].join('\r\n');
        const encoded = Buffer.from(message).toString('base64url');
        const res = await gmail.users.messages.send({ userId: user, requestBody: { raw: encoded } });
        return res.data;
      },
    });
  },
};

export default plugin;
