import type { ClosureDefinition } from 'rule-loom-engine';
import type { RunnerConfig } from './config.js';
export type ValidationIssueLevel = 'error' | 'warning';
export interface ValidationIssue {
    level: ValidationIssueLevel;
    message: string;
    flow?: string;
    closure?: string;
    path?: string;
}
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}
export declare class RunnerValidationError extends Error {
    result: ValidationResult;
    constructor(result: ValidationResult);
}
export declare function validateRunnerConfig(config: RunnerConfig, closures: ClosureDefinition[]): ValidationResult;
//# sourceMappingURL=validator.d.ts.map