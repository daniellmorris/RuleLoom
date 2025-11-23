import express from 'express';
import createError from 'http-errors';
import morgan from 'morgan';
import _ from 'lodash';
import { z } from 'zod';
function buildInitialState(req) {
    return {
        request: {
            method: req.method,
            path: req.path,
            headers: req.headers,
            query: req.query,
            params: req.params,
            body: req.body,
        },
    };
}
function applyResponse(res, result, route) {
    const stateResponse = _.get(result.state, 'response');
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
    }
    else if (typeof body === 'object') {
        res.status(status).json(body);
    }
    else {
        res.status(status).send(String(body));
    }
}
function routeHandler(engine, route, logger, metadata) {
    return async (req, res, next) => {
        try {
            const initialState = buildInitialState(req);
            const runtime = {
                logger,
                route,
                configMetadata: metadata,
                requestId: req.headers['x-request-id'] ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            };
            const result = await engine.execute(route.flow, initialState, runtime);
            applyResponse(res, result, route);
        }
        catch (error) {
            next(error);
        }
    };
}
export const httpInputSchema = z.object({
    type: z.literal('http'),
    id: z.string().optional(),
    basePath: z.string().optional(),
    bodyLimit: z.union([z.string(), z.number()]).optional(),
    routes: z.array(z.object({
        id: z.string().optional(),
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
    })).min(1),
});
export const httpInputPlugin = {
    type: 'http',
    schema: httpInputSchema,
    initialize: async (config, { logger, engine, metadata }) => {
        const httpInput = createHttpInputApp(engine, config, { logger, metadata });
        return {
            http: { app: httpInput, basePath: config.basePath ?? '/' },
            cleanup: async () => {
                httpInput.removeAllListeners();
            },
        };
    },
};
export function createHttpInputApp(engine, input, options) {
    const app = express();
    const limit = input.bodyLimit ?? '1mb';
    app.use(express.json({ limit }));
    app.use(express.urlencoded({ extended: true, limit }));
    app.use(morgan('combined'));
    for (const route of input.routes) {
        const method = (route.method ?? 'post').toLowerCase();
        const handler = routeHandler(engine, route, options.logger, options.metadata);
        app[method](route.path, handler);
        options.logger.info(`Registered route [${method.toUpperCase()}] ${route.path} -> flow "${route.flow}"`);
    }
    app.use((req, res, next) => {
        next(createError(404, `No route configured for ${req.method} ${req.path}`));
    });
    app.use((err, _req, res, _next) => {
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
export function createPlaceholderHttpApp(logger) {
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
//# sourceMappingURL=http.js.map