import express, { type Request, type Response, type NextFunction } from 'express';
import createError from 'http-errors';
import morgan from 'morgan';
import _ from 'lodash';
import { z } from 'zod';
import type { RuleLoomEngine, ExecutionRuntime } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { HttpInputConfig, HttpTriggerConfig, HttpInputApp, InputPlugin } from './types.js';

function buildInitialState(req: Request) {
  return {
    request: {
      method: req.method,
      path: req.path,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
    },
  } as Record<string, unknown>;
}

function applyResponse(res: Response, result: { state: Record<string, unknown>; lastResult: unknown }, route: HttpTriggerConfig) {
  const stateResponse = _.get(result.state, 'response') as
    | { status?: number; body?: unknown; headers?: Record<string, string> }
    | undefined;

  const chosen = stateResponse ?? route.respondWith ?? {};
  const status = chosen.status ?? (stateResponse ? 200 : 200);
  const headers = chosen.headers ?? {};
  const body = stateResponse?.body ?? route.respondWith?.body ?? result.lastResult ?? result.state;

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      res.setHeader(key, value);
    }
  });

  if (body === undefined) {
    res.sendStatus(status);
  } else if (typeof body === 'object') {
    res.status(status).json(body);
  } else {
    res.status(status).send(String(body));
  }
}

function routeHandler(
  engine: RuleLoomEngine,
  route: HttpTriggerConfig,
  logger: RuleLoomLogger,
  metadata?: Record<string, unknown>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const initialState = buildInitialState(req);
      const runtime: ExecutionRuntime = {
        logger,
        route,
        configMetadata: metadata,
        requestId: req.headers['x-request-id'] ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      const result = await engine.execute(route.flow, initialState, runtime);
      applyResponse(res, result, route);
    } catch (error) {
      next(error);
    }
  };
}

export interface CreateHttpInputOptions {
  logger: RuleLoomLogger;
  metadata?: Record<string, unknown>;
}

export const httpInputSchema = z.object({
  type: z.literal('http'),
  id: z.string().optional(),
  config: z
    .object({
      basePath: z.string().optional(),
      bodyLimit: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  triggers: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.literal('httpRoute').optional(),
        method: z.enum(['get', 'post', 'put', 'patch', 'delete']).optional(),
        path: z.string().min(1),
        flow: z.string().min(1),
        respondWith: z
          .object({
            status: z.number().int().optional(),
            headers: z.record(z.string()).optional(),
            body: z.any().optional(),
          })
          .optional(),
      }),
    )
    .min(1),
});

export const httpInputPlugin: InputPlugin<HttpInputConfig> = {
  type: 'http',
  schema: httpInputSchema,
  initialize: async (config: HttpInputConfig, { logger, engine, metadata }) => {
    const httpInput = createHttpInputApp(engine, config, { logger, metadata });
    return {
      http: { app: httpInput, basePath: config.config?.basePath ?? '/' },
      cleanup: async () => {
        httpInput.removeAllListeners();
      },
    };
  },
};

export function createHttpInputApp(engine: RuleLoomEngine, input: HttpInputConfig, options: CreateHttpInputOptions): HttpInputApp {
  const app = express();
  const limit = input.config?.bodyLimit ?? '1mb';
  app.use(express.json({ limit }));
  app.use(express.urlencoded({ extended: true, limit }));
  app.use(morgan('combined'));

  for (const route of input.triggers) {
    const method = (route.method ?? 'post').toLowerCase();
    const handler = routeHandler(engine, route, options.logger, options.metadata);
    (app as any)[method](route.path, handler);
    options.logger.info(`Registered route [${method.toUpperCase()}] ${route.path} -> flow "${route.flow}"`);
  }

  app.use((req, res, next) => {
    next(createError(404, `No route configured for ${req.method} ${req.path}`));
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error('Unhandled error during request', err);
    if (res.headersSent) {
      return;
    }
    const status = err.status ?? 500;
    res.status(status).json({
      error: {
        message: err.message ?? 'Internal Server Error',
        status,
      },
    });
  });

  return app;
}

export function createPlaceholderHttpApp(logger?: RuleLoomLogger): HttpInputApp {
  const app = express();
  app.use((_req, res) => {
    logger?.warn?.('Request received but no HTTP inputs are configured.');
    res.status(404).json({
      error: {
        message: 'No HTTP inputs configured for this runner.',
      },
    });
  });
  return app;
}
