import _ from 'lodash';
function getContextValue(path, context) {
    const trimmed = path.trim();
    if (trimmed.startsWith('state.')) {
        return _.get(context.state, trimmed.slice(6));
    }
    if (trimmed.startsWith('runtime.')) {
        return _.get(context.runtime, trimmed.slice(8));
    }
    if (trimmed.startsWith('params.') || trimmed.startsWith('parameters.')) {
        return _.get(context.parameters ?? {}, trimmed.replace(/^parameters?\./, ''));
    }
    // Default to state lookup
    return _.get(context.state, trimmed);
}
function resolveString(value, context) {
    const fullMatch = value.match(/^\$\{([^}]+)\}$/);
    if (fullMatch) {
        return getContextValue(fullMatch[1], context);
    }
    return value.replace(/\$\{([^}]+)\}/g, (_, rawPath) => {
        const resolved = getContextValue(rawPath, context);
        if (resolved === undefined || resolved === null) {
            return '';
        }
        return String(resolved);
    });
}
export function resolveDynamicValues(value, context) {
    if (typeof value === 'string') {
        return resolveString(value, context);
    }
    if (Array.isArray(value)) {
        return value.map((item) => resolveDynamicValues(item, context));
    }
    if (value && typeof value === 'object') {
        const output = {};
        for (const [key, val] of Object.entries(value)) {
            output[key] = resolveDynamicValues(val, context);
        }
        return output;
    }
    return value;
}
//# sourceMappingURL=utils.js.map