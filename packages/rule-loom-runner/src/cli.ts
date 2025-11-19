#!/usr/bin/env node
import { Command } from 'commander';
import { startRunner } from './index.js';

const program = new Command();

program
  .name('ruleloom-runner')
  .description('Run RuleLoom configuration files')
  .option('-c, --config <path>', 'Path to configuration file', 'config.yaml')
  .option('-p, --port <number>', 'Port override', (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid port: ${value}`);
    }
    return parsed;
  })
  .action(async (options) => {
    try {
      const { instance } = await startRunner({
        configPath: options.config,
        portOverride: options.port,
      });

      const shutdown = async (signal: string) => {
        instance.logger.info(`Received ${signal}; shutting down.`);
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
      console.error('Failed to start RuleLoom Runner:', error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
