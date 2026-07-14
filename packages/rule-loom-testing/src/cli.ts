#!/usr/bin/env node
import { Command } from 'commander';
import { runYamlTests, type RuleLoomTestRunResult } from './index.js';

const program = new Command();

program
  .name('ruleloom-testing')
  .description('Run RuleLoom YAML tests')
  .command('test')
  .argument('<config>', 'RuleLoom YAML config containing a tests array')
  .option('-r, --reporter <reporter>', 'summary, json, or tap', 'summary')
  .action(async (config: string, options: { reporter: string }) => {
    try {
      const result = await runYamlTests({ configPath: config });
      printResult(result, options.reporter);
      process.exit(result.passed ? 0 : 1);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

function printResult(result: RuleLoomTestRunResult, reporter: string): void {
  if (reporter === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (reporter === 'tap') {
    console.log('TAP version 13');
    console.log(`1..${result.results.length}`);
    result.results.forEach((test, index) => {
      console.log(`${test.passed ? 'ok' : 'not ok'} ${index + 1} - ${test.name}`);
      test.failures.forEach((failure) => {
        console.log(`  ---`);
        console.log(`  message: ${JSON.stringify(failure.message)}`);
        console.log(`  traceEvents: ${failure.trace?.length ?? test.trace.length}`);
        console.log(`  ...`);
      });
    });
    return;
  }

  const passed = result.results.filter((test) => test.passed).length;
  console.log(`${passed}/${result.results.length} RuleLoom YAML tests passed`);
  result.results.forEach((test) => {
    console.log(`${test.passed ? 'PASS' : 'FAIL'} ${test.name}`);
    test.failures.forEach((failure) => {
      console.log(`  - ${failure.message}`);
      console.log(`    trace events: ${failure.trace?.length ?? test.trace.length}`);
    });
  });
}

program.parseAsync(process.argv);
