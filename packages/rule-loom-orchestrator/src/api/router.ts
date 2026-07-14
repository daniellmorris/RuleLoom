import express from 'express';
import { RunnerRegistry } from '../registry.js';
import { RunnerStore } from '../persistence/runnerStore.js';
import {
  listRunners,
  createRunnerController,
  getRunner,
  deleteRunner,
  getRunnerRoutes,
  getRunnerJobs,
  getRunnerHealth,
  updateRunnerController,
  getRunnerConfigController,
  validateRunnerConfigController,
} from './controllers/runners.js';

export function createRouter(registry: RunnerRegistry, store: RunnerStore): express.Router {
  const router = express.Router();
  const asyncHandler = (handler: express.RequestHandler): express.RequestHandler =>
    (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', runners: registry.list().length });
  });
  router.get('/meta', (_req, res) => {
    res.json({
      name: 'rule-loom-orchestrator',
      version: '0.1.0',
      ...(process.env.RULE_LOOM_COMMIT_SHA ? { commit: process.env.RULE_LOOM_COMMIT_SHA } : {}),
    });
  });
  router.get('/runners', listRunners(registry));
  router.post('/runners', asyncHandler(createRunnerController(registry, store)));
  router.post('/runners/validate', asyncHandler(validateRunnerConfigController()));
  router.get('/runners/:id', getRunner(registry));
  router.put('/runners/:id', asyncHandler(updateRunnerController(registry, store)));
  router.delete('/runners/:id', asyncHandler(deleteRunner(registry, store)));
  router.get('/runners/:id/config', asyncHandler(getRunnerConfigController(registry)));
  router.get('/runners/:id/routes', getRunnerRoutes(registry));
  router.get('/runners/:id/jobs', getRunnerJobs(registry));
  router.get('/runners/:id/health', getRunnerHealth(registry));

  return router;
}
