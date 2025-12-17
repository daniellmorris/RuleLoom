import express, { type Request, type Response, type NextFunction } from 'express';
import createError from 'http-errors';
import morgan from 'morgan';
import _ from 'lodash';
import { z } from 'zod';
import type { RuleLoomEngine, ExecutionRuntime } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { BaseInputConfig, InputPlugin, InputPluginContext } from 'rule-loom-runner/src/pluginApi.js';

export interface HttpRouteRespondWith {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpTriggerConfig {
  id?: string;
  type?: 'httpRoute';
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  flow: string;
  respondWith?: HttpRouteRespondWith;
}

export interface HttpInputConfig extends BaseInputConfig {
  type: 'http';
  config?: {
    basePath?: string;
    bodyLimit?: string | number;
  };
  triggers: HttpTriggerConfig[];
}

export type HttpInputApp = express.Express;

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

export const httpConfigParameters = [
  { name: 'basePath', type: 'string', required: false, description: 'Prefix for all routes' },
  { name: 'bodyLimit', type: 'string', required: false, description: 'JSON body limit (e.g. 1mb)' },
];

export const httpTriggerParameters = [
  { name: 'method', type: 'string', required: false, description: 'HTTP method', enum: ['get', 'post', 'put', 'patch', 'delete'] },
  { name: 'path', type: 'string', required: true, description: 'Route path' },
  { name: 'flow', type: 'string', required: true, description: 'Target flow name' },
  { name: 'respondWith', type: 'any', required: false, description: 'Static fallback response' },
];

function buildHttpSchema() {
  const toZod = (p: any) => {
    switch (p.type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      default:
        return z.any();
    }
  };
  const configShape: Record<string, any> = {};
  httpConfigParameters.forEach((p) => {
    const shape = p.required ? toZod(p) : toZod(p).optional();
    configShape[p.name] = shape;
  });
  const triggerShape: Record<string, any> = {
    id: z.string().optional(),
    type: z.literal('httpRoute').optional(),
  };
  httpTriggerParameters.forEach((p) => {
    const shape = p.required ? toZod(p) : toZod(p).optional();
    triggerShape[p.name] = shape;
  });

  return z.object({
    type: z.literal('http'),
    id: z.string().optional(),
    config: z.object(configShape).optional(),
    triggers: z.array(z.object(triggerShape)).min(1),
  });
}

export const httpInputSchema = buildHttpSchema();

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
    options.logger.info?.(`Registered route [${method.toUpperCase()}] ${route.path} -> flow "${route.flow}"`);
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

export const httpInputPlugin: InputPlugin<HttpInputConfig> = {
  type: 'http',
  schema: httpInputSchema,
  configParameters: httpConfigParameters,
  triggerParameters: httpTriggerParameters,
  initialize: async (config: HttpInputConfig, { logger, engine, metadata }: InputPluginContext) => {
    const httpApp = createHttpInputApp(engine, config, { logger, metadata });
    return {
      services: {
        httpApp,
        httpBasePath: config.config?.basePath ?? '/',
      },
      cleanup: async () => {
        httpApp.removeAllListeners();
      },
    };
  },
};
