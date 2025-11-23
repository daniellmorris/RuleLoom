import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type QueryParams = {
  connectionString: string;
  text: string;
  values?: unknown[];
};

export const plugin = {
  name: 'rule-loom-plugin-postgres',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 'postgres.query',
      description: 'Execute a SQL query against Postgres',
      signature: {
        parameters: [
          { name: 'connectionString', type: 'string', required: true },
          { name: 'text', type: 'string', required: true },
          { name: 'values', type: 'array', required: false },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { connectionString, text, values } = parameters as QueryParams;
        const { Client } = await import('pg');
        const client = new Client({ connectionString });
        await client.connect();
        try {
          const result = await client.query(text, values);
          return { rows: result.rows, rowCount: result.rowCount };
        } finally {
          await client.end();
        }
      },
    });
  },
};

export default plugin;
