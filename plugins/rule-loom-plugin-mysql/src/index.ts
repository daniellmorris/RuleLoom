import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type QueryParams = {
  uri: string;
  sql: string;
  values?: unknown[];
};

export const plugin = {
  name: 'rule-loom-plugin-mysql',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 'mysql.query',
      description: 'Execute a SQL query against MySQL',
      signature: {
        parameters: [
          { name: 'uri', type: 'string', required: true },
          { name: 'sql', type: 'string', required: true },
          { name: 'values', type: 'array', required: false },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { uri, sql, values } = parameters as QueryParams;
        const mysql = await import('mysql2/promise');
        const conn = await mysql.createConnection(uri);
        try {
          const [rows] = await conn.execute(sql, values);
          return { rows };
        } finally {
          await conn.end();
        }
      },
    });
  },
};

export default plugin;
