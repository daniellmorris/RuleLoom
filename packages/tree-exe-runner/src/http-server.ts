import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import createError from 'http-errors';
import morgan from 'morgan';
import _ from 'lodash';
import type { TreeExeEngine, ExecutionRuntime } from 'tree-exe-engine';
import type { RunnerConfig, HttpRouteConfig } from './config.js';
import type { TreeExeLogger } from 'tree-exe-lib';

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

function applyResponse(res: Response, result: { state: Record<string, unknown>; lastResult: unknown }, route: HttpRouteConfig) {
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
  engine: TreeExeEngine,
  config: RunnerConfig,
  route: HttpRouteConfig,
  logger: TreeExeLogger,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const initialState = buildInitialState(req);
      const runtime: ExecutionRuntime = {
        logger,
        route,
        configMetadata: config.metadata,
        requestId: req.headers['x-request-id'] ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      const result = await engine.execute(route.flow, initialState, runtime);
      applyResponse(res, result, route);
    } catch (error) {
      next(error);
    }
  };
}

export function createRunnerApp(
  engine: TreeExeEngine,
  config: RunnerConfig,
  logger: TreeExeLogger,
): Express {
  const app = express();
  app.use(express.json({ limit: config.server.http.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.server.http.bodyLimit }));
  app.use(morgan('combined'));

  for (const route of config.server.http.routes) {
    const method = route.method?.toLowerCase() ?? 'post';
    const handler = routeHandler(engine, config, route, logger);
    (app as any)[method](route.path, handler);
    logger.info(`Registered route [${method.toUpperCase()}] ${route.path} -> flow "${route.flow}"`);
  }

  app.use((req, res, next) => {
    next(createError(404, `No route configured for ${req.method} ${req.path}`));
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error during request', err);
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
