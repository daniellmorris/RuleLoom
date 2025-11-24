export class RunnerValidationError extends Error {
    constructor(result) {
        super('Runner configuration validation failed');
        this.result = result;
        this.name = 'RunnerValidationError';
    }
}
export function validateRunnerConfig(config, closures) {
    const issues = [];
    const signatureByClosure = new Map();
    for (const closure of closures) {
        if (!closure.signature) {
            issues.push({
                level: 'error',
                message: `Closure "${closure.name}" is missing signature metadata.`,
                closure: closure.name,
            });
            continue;
        }
        signatureByClosure.set(closure.name, closure.signature);
    }
    for (const flow of config.flows ?? []) {
        validateFlow(flow, signatureByClosure, issues);
    }
    return { valid: issues.every((issue) => issue.level !== 'error'), issues };
}
function validateFlow(flow, signatureByClosure, issues) {
    const visitSteps = (steps, path) => {
        steps.forEach((step, index) => {
            if (isBranchStep(step)) {
                const branchPath = `${path}.steps[${index}]`;
                step.cases.forEach((branchCase, caseIndex) => {
                    validateConditions(branchCase.when, flow.name, `${branchPath}.cases[${caseIndex}]`, signatureByClosure, issues);
                    visitSteps(branchCase.steps, `${branchPath}.cases[${caseIndex}]`);
                });
                if (step.otherwise) {
                    visitSteps(step.otherwise, `${branchPath}.otherwise`);
                }
                return;
            }
            validateInvokeStep(step, flow.name, `${path}.steps[${index}]`, signatureByClosure, issues);
            if (step.when) {
                validateConditions(step.when, flow.name, `${path}.steps[${index}].when`, signatureByClosure, issues);
            }
        });
    };
    visitSteps(flow.steps ?? [], `flows[${flow.name}]`);
}
function validateInvokeStep(step, flowName, path, signatureByClosure, issues) {
    const signature = signatureByClosure.get(step.closure);
    if (!signature) {
        issues.push({ level: 'error', message: `Closure "${step.closure}" is not registered.`, flow: flowName, closure: step.closure, path });
        return;
    }
    validateParameters(step.parameters ?? {}, signature, flowName, step.closure, path, issues);
}
function validateConditions(when, flowName, path, signatureByClosure, issues) {
    if (Array.isArray(when)) {
        when.forEach((condition, index) => validateSingleCondition(condition, flowName, `${path}[${index}]`, signatureByClosure, issues));
        return;
    }
    validateSingleCondition(when, flowName, path, signatureByClosure, issues);
}
function validateSingleCondition(condition, flowName, path, signatureByClosure, issues) {
    const signature = signatureByClosure.get(condition.closure);
    if (!signature) {
        issues.push({
            level: 'error',
            message: `Condition closure "${condition.closure}" is not registered.`,
            flow: flowName,
            closure: condition.closure,
            path,
        });
        return;
    }
    validateParameters(condition.parameters ?? {}, signature, flowName, condition.closure, path, issues);
}
function validateParameters(parameters, signature, flowName, closureName, path, issues) {
    const descriptors = signature.parameters ?? [];
    const providedKeys = new Set(Object.keys(parameters));
    for (const descriptor of descriptors) {
        if (descriptor.required) {
            const value = parameters[descriptor.name];
            if (value === undefined || value === null) {
                issues.push({
                    level: 'error',
                    message: `Closure "${closureName}" is missing required parameter "${descriptor.name}".`,
                    flow: flowName,
                    closure: closureName,
                    path,
                });
                continue;
            }
        }
        const value = parameters[descriptor.name];
        if (value !== undefined && descriptor.type === 'flowSteps' && !Array.isArray(value)) {
            issues.push({
                level: 'error',
                message: `Parameter "${descriptor.name}" on closure "${closureName}" must be an array of steps.`,
                flow: flowName,
                closure: closureName,
                path,
            });
        }
    }
    if (signature.allowAdditionalParameters) {
        return;
    }
    const allowedNames = new Set(descriptors.map((descriptor) => descriptor.name));
    for (const key of providedKeys) {
        if (!allowedNames.has(key)) {
            issues.push({
                level: 'error',
                message: `Parameter "${key}" is not defined for closure "${closureName}".`,
                flow: flowName,
                closure: closureName,
                path,
            });
        }
    }
}
function isBranchStep(step) {
    return step.cases !== undefined;
}
//# sourceMappingURL=validator.js.map