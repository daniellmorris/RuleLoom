import express, { type Request, type Response, type NextFunction } from 'express';
import cors, { type CorsOptions } from 'cors';
import http from 'node:http';
import createError from 'http-errors';
import morgan from 'morgan';
import _ from 'lodash';
import { z } from 'zod';
import type { RuleLoomEngine, ExecutionRuntime, RecorderEvent } from 'rule-loom-engine';
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
    port?: number;
    corsOrigins?: string | string[];
    corsMethods?: string | string[];
    corsAllowedHeaders?: string | string[];
  };
  triggers: HttpTriggerConfig[];
}

export type HttpInputApp = express.Express;

type SharedHttpServer = {
  app: express.Express;
  server: http.Server;
  refs: number;
};

const sharedServers = new Map<number, SharedHttpServer>();

function buildInitialState(req: Request, inputId?: string) {
  return {
    ...(inputId ? { inputId } : {}),
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
  inputId?: string,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const initialState = buildInitialState(req, inputId);
      const runtime: ExecutionRuntime = {
        logger,
        route,
        configMetadata: metadata,
        inputId,
        requestId: req.headers['x-request-id'] ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      const result = await engine.execute(route.flow, initialState, runtime);
      applyResponse(res, result, route);
    } catch (error) {
      next(error);
    }
  };
}

function runnerExecuteHandler(
  engine: RuleLoomEngine,
  logger: RuleLoomLogger,
  metadata?: Record<string, unknown>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flow = req.body?.flow;
      if (!flow || typeof flow !== 'string') {
        res.status(400).json({ error: { message: 'Runner execution requires a string "flow".', status: 400 } });
        return;
      }
      const trace: RecorderEvent[] = [];
      const wantsTrace = req.body?.trace !== false;
      const state =
        req.body?.state && typeof req.body.state === 'object'
          ? req.body.state
          : Object.prototype.hasOwnProperty.call(req.body ?? {}, 'payload')
            ? { payload: req.body.payload }
            : {};
      const runtime: ExecutionRuntime = {
        logger,
        configMetadata: metadata,
        requestId: req.headers['x-request-id'] ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        runnerCall: true,
        simulate: Boolean(req.body?.simulate),
        ...(wantsTrace
          ? {
              recordLevel: 'full',
              recorder: { onEvent: (event: RecorderEvent) => trace.push(event) },
            }
          : {}),
      };
      const result = await engine.execute(flow, state, runtime);
      res.json({
        flow,
        state: result.state,
        lastResult: result.lastResult,
        ...(wantsTrace ? { trace } : {}),
      });
    } catch (error) {
      next(error);
    }
  };
}

export interface CreateHttpInputOptions {
  logger: RuleLoomLogger;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export const httpConfigParameters = [
  { name: 'basePath', type: 'string', required: false, description: 'Prefix for all routes' },
  { name: 'bodyLimit', type: 'string', required: false, description: 'JSON body limit (e.g. 1mb)' },
  { name: 'port', type: 'number', required: false, description: 'Port for the standalone HTTP server (defaults to 3000)' },
  { name: 'corsOrigins', type: 'string', required: false, description: 'CORS allowed origins (comma-separated or array)' },
  { name: 'corsMethods', type: 'string', required: false, description: 'CORS allowed methods (comma-separated or array)' },
  { name: 'corsAllowedHeaders', type: 'string', required: false, description: 'CORS allowed headers (comma-separated or array)' },
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
      case 'object':
        return z.record(z.any());
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

function normalizeBasePath(basePath?: string) {
  const raw = (basePath ?? '/').trim();
  if (!raw || raw === '/') {
    return '/';
  }
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed;
}

function combineBasePaths(namespace?: string, basePath?: string) {
  const normalizedNamespace = normalizeBasePath(namespace);
  const normalizedBase = normalizeBasePath(basePath);
  if (normalizedNamespace === '/') {
    return normalizedBase;
  }
  if (normalizedBase === '/') {
    return normalizedNamespace;
  }
  return `${normalizedNamespace}${normalizedBase}`;
}

function normalizeRoutePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeCorsList(value?: string | string[]) {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function createHttpInputApp(engine: RuleLoomEngine, input: HttpInputConfig, options: CreateHttpInputOptions): HttpInputApp {
  const app = express();
  configureHttpApp(app, input);
  mountHttpInputRoutes(app, engine, input, options);
  mountNotFoundHandler(app, options.logger);
  return app;
}

function configureHttpApp(app: express.Express, input: HttpInputConfig) {
  const limit = input.config?.bodyLimit ?? '1mb';
  app.use(express.json({ limit }));
  app.use(express.urlencoded({ extended: true, limit }));
  app.use(morgan('combined'));
}

function mountHttpInputRoutes(app: express.Express, engine: RuleLoomEngine, input: HttpInputConfig, options: CreateHttpInputOptions) {
  const basePath = combineBasePaths(options.namespace, input.config?.basePath);
  const router = express.Router();
  const corsOrigins = normalizeCorsList(input.config?.corsOrigins);
  const corsMethods = normalizeCorsList(input.config?.corsMethods);
  const corsAllowedHeaders = normalizeCorsList(input.config?.corsAllowedHeaders);

  if (corsOrigins || corsMethods || corsAllowedHeaders) {
    const corsOptions: CorsOptions = {
      origin: corsOrigins,
      methods: corsMethods,
      allowedHeaders: corsAllowedHeaders,
    };
    router.use(cors(corsOptions));
  }

  router.post('/__ruleloom/run', runnerExecuteHandler(engine, options.logger, options.metadata));

  for (const route of input.triggers) {
    const method = (route.method ?? 'post').toLowerCase();
    const handler = routeHandler(engine, route, options.logger, options.metadata, input.id);
    const routePath = normalizeRoutePath(route.path);
    (router as any)[method](routePath, handler);
    const fullPath = basePath === '/' ? routePath : `${basePath}${routePath}`;
    options.logger.info?.(`Registered route [${method.toUpperCase()}] ${fullPath} -> flow "${route.flow}"`);
  }

  if (basePath === '/') {
    app.use(router);
  } else {
    app.use(basePath, router);
  }
}

function mountNotFoundHandler(app: express.Express, logger: RuleLoomLogger) {
  app.use((req, res, next) => {
    next(createError(404, `No route configured for ${req.method} ${req.path}`));
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error?.('Unhandled error during request', err);
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
}

export const httpInputPlugin: InputPlugin<HttpInputConfig> = {
  type: 'http',
  schema: httpInputSchema,
  configParameters: httpConfigParameters,
  triggerParameters: httpTriggerParameters,
  initialize: async (config: HttpInputConfig, { logger, engine, metadata, namespace }: InputPluginContext) => {
    const port = Number(config.config?.port ?? 3000);
    const basePath = combineBasePaths(namespace, config.config?.basePath);
    const shared = await getOrCreateSharedServer(port, config, logger);
    mountHttpInputRoutes(shared.app, engine, config, { logger, metadata, namespace });
    logger.info?.(`HTTP input listening on port ${actualPort(shared.server, port)}${basePath === '/' ? '' : basePath}`);
    return {
      services: {
        httpApp: shared.app,
        httpBasePath: combineBasePaths(namespace, config.config?.basePath),
        httpServer: shared.server,
      },
      cleanup: async () => {
        await releaseSharedServer(port, shared);
      },
    };
  },
};

async function getOrCreateSharedServer(port: number, config: HttpInputConfig, logger: RuleLoomLogger): Promise<SharedHttpServer> {
  if (port !== 0) {
    const existing = sharedServers.get(port);
    if (existing) {
      existing.refs += 1;
      return existing;
    }
  }
  const app = express();
  configureHttpApp(app, config);
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      logger.debug?.(`HTTP shared server bound on port ${actualPort(server, port)}`);
      resolve();
    });
  });
  const shared = { app, server, refs: 1 };
  if (port !== 0) {
    sharedServers.set(port, shared);
  }
  return shared;
}

async function releaseSharedServer(port: number, sharedForEphemeral?: SharedHttpServer): Promise<void> {
  if (port === 0) {
    if (sharedForEphemeral) {
      await new Promise<void>((resolve) => sharedForEphemeral.server.close(() => resolve()));
      sharedForEphemeral.app.removeAllListeners();
    }
    return;
  }
  const shared = sharedServers.get(port);
  if (!shared) return;
  shared.refs -= 1;
  if (shared.refs > 0) return;
  sharedServers.delete(port);
  await new Promise<void>((resolve) => shared.server.close(() => resolve()));
  shared.app.removeAllListeners();
}

function actualPort(server: http.Server, fallback: number) {
  const address = server.address();
  return typeof address === 'object' && address ? address.port : fallback;
}
