export interface FeatureDefinition {
  name: string;
  description: string;
  config: string;
}

export const FEATURES: FeatureDefinition[] = [
  {
    name: 'Branching & Core Closures',
    description: 'Demonstrates branch inference, core comparisons, and $call to compute derived fields.',
    config: 'branching.yaml',
  },
  {
    name: '$call Inline Closure Execution',
    description: 'Uses $call to run closures/steps inline and inject the result into subsequent steps.',
    config: 'call-inline.yaml',
  },
  {
    name: 'Functional Parameters (core.for-each)',
    description: 'Iterates over collections using inline step lambdas.',
    config: 'functional.yaml',
  },
  {
    name: 'Flow Closures',
    description: 'Reuses flow-defined closures in other flows.',
    config: 'flow-closure.yaml',
  },
  {
    name: 'Module Closures',
    description: 'Loads custom closures from a module and references them via $call.',
    config: 'module.yaml',
  },
  {
    name: 'Scheduler Jobs',
    description: 'Runs flows on intervals using Bree-backed task scheduler.',
    config: 'scheduler.yaml',
  },
];
