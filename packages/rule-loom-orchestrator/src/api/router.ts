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
} from './controllers/runners.js';

export function createRouter(registry: RunnerRegistry, store: RunnerStore): express.Router {
  const router = express.Router();

  router.get('/runners', listRunners(registry));
  router.post('/runners', createRunnerController(registry, store));
  router.get('/runners/:id', getRunner(registry));
  router.put('/runners/:id', updateRunnerController(registry, store));
  router.delete('/runners/:id', deleteRunner(registry, store));
  router.get('/runners/:id/config', getRunnerConfigController(registry));
  router.get('/runners/:id/routes', getRunnerRoutes(registry));
  router.get('/runners/:id/jobs', getRunnerJobs(registry));
  router.get('/runners/:id/health', getRunnerHealth(registry));

  return router;
}
