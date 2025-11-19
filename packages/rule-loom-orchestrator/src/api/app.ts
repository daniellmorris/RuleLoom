import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { middleware as openApiMiddleware } from 'express-openapi-validator';
import SwaggerParser from '@apidevtools/swagger-parser';
import { RunnerRegistry } from '../registry.js';
import { createRouter } from './router.js';

export interface OrchestratorApiOptions {
  basePath?: string;
  specPath?: string;
}

export async function createOrchestratorApi(
  registry: RunnerRegistry,
  options: OrchestratorApiOptions = {},
): Promise<express.Router> {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const specPath = options.specPath ?? path.resolve(moduleDir, '../..', 'openapi/openapi.yaml');
  const rawSpec = await fs.readFile(specPath, 'utf8');
  const apiSpec = YAML.parse(rawSpec);
  await SwaggerParser.validate(apiSpec);

  router.use('/docs', swaggerUi.serve, swaggerUi.setup(apiSpec));

  router.use(
    openApiMiddleware({
      apiSpec,
      validateRequests: true,
      validateResponses: true,
    }),
  );

  router.use(createRouter(registry));

  router.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && err.status) {
      res.status(err.status).json({ message: err.message, errors: err.errors });
    } else {
      next(err);
    }
  });

  return router;
}
