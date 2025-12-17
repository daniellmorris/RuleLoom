#!/usr/bin/env node
import { Command } from "commander";
import { RunnerValidationError, startRunner, validateConfig } from "./index.js";
import { generateManifest } from "./manifest.js";

const program = new Command();

program
  .name("ruleloom-runner")
  .description("Run RuleLoom configuration files")
  .option("-c, --config <path>", "Path to configuration file", "config.yaml")
  .action(async (options) => {
    try {
      const { instance } = await startRunner({
        configPath: options.config,
      });

      const shutdown = async (signal: string) => {
        instance.logger.info(`Received ${signal}; shutting down.`);
        await instance.close();
        process.exit(0);
      };

      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error: unknown) {
      if (error instanceof RunnerValidationError) {
        printIssues(error.result.issues);
      } else {
        console.error("Failed to start RuleLoom Runner:", error as Error);
      }
      process.exit(1);
    }
  });

program
  .command("validate")
  .description("Validate a configuration without running it")
  .option("-c, --config <path>", "Path to configuration file", "config.yaml")
  .action(async (options) => {
    try {
      const result = await validateConfig(options.config);
      if (!result.valid) {
        printIssues(result.issues);
        process.exit(1);
      }
      console.log("Configuration is valid.");
    } catch (error: unknown) {
      console.error(
        "Failed to validate RuleLoom configuration:",
        error as Error,
      );
      process.exit(1);
    }
  });

program
  .command("manifest")
  .description("Generate a ruleloom.manifest.yaml for a plugin package")
  .argument("[pluginDir]", "Path to the plugin package", ".")
  .option(
    "-o, --out <path>",
    "Output path for the manifest (defaults to <pluginDir>/ruleloom.manifest.yaml)",
  )
  .action(async (pluginDir, options) => {
    try {
      const { manifestPath } = await generateManifest({
        pluginDir,
        outputPath: options.out,
      });
      console.log(`Manifest written to ${manifestPath}`);
    } catch (error: unknown) {
      console.error("Failed to generate manifest:", error as Error);
      process.exit(1);
    }
  });

function printIssues(
  issues: { level: string; message: string; path?: string }[],
) {
  for (const issue of issues) {
    console.error(
      `[${issue.level}] ${issue.message}${issue.path ? ` @ ${issue.path}` : ""}`,
    );
  }
}

program.parseAsync(process.argv);
