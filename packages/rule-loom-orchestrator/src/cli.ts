#!/usr/bin/env node
import { Command } from 'commander';
import { startOrchestrator } from './index.js';

const program = new Command();

program
  .name('ruleloom-orchestrator')
  .description('Run multiple RuleLoom configs within a single server')
  .option('-c, --config <path>', 'Path to orchestrator configuration file', 'orchestrator.yaml')
  .option('-p, --port <number>', 'Port override', (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid port: ${value}`);
    }
    return parsed;
  })
  .action(async (options) => {
    try {
      const { instance } = await startOrchestrator({
        configPath: options.config,
        portOverride: options.port,
      });

      const shutdown = async (signal: string) => {
        instance.logger.info(`Received ${signal}; shutting down orchestrator.`);
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
      console.error('Failed to start RuleLoom Orchestrator:', error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
