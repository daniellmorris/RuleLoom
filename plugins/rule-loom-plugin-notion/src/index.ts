import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type NotionParams = {
  token: string;
  databaseId: string;
  properties: Record<string, unknown>;
};

type QueryParams = {
  token: string;
  databaseId: string;
  filter?: any;
  sorts?: any;
};

export const plugin = {
  name: 'rule-loom-plugin-notion',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 'notion.createPage',
      description: 'Create a page in a Notion database',
      signature: {
        parameters: [
          { name: 'token', type: 'string', required: true },
          { name: 'databaseId', type: 'string', required: true },
          { name: 'properties', type: 'object', required: true },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { Client } = await import('@notionhq/client');
        const { token, databaseId, properties } = parameters as NotionParams;
        const client = new Client({ auth: token });
        const res = await client.pages.create({ parent: { database_id: databaseId }, properties: properties as any });
        return res;
      },
    });

    ctx.registerClosure({
      name: 'notion.queryDatabase',
      description: 'Query a Notion database',
      signature: {
        parameters: [
          { name: 'token', type: 'string', required: true },
          { name: 'databaseId', type: 'string', required: true },
          { name: 'filter', type: 'any', required: false },
          { name: 'sorts', type: 'any', required: false },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { Client } = await import('@notionhq/client');
        const { token, databaseId, filter, sorts } = parameters as QueryParams;
        const client = new Client({ auth: token });
        const res = await client.databases.query({ database_id: databaseId, filter: filter as any, sorts: sorts as any });
        return res;
      },
    });
  },
};

export default plugin;
