const closureRegistry = new Map();
export function registerClosure(closure) {
    const name = closure.name;
    if (!name) {
        throw new Error('Registered closure must have a name');
    }
    if (closureRegistry.has(name)) {
        throw new Error(`Closure "${name}" already registered`);
    }
    closureRegistry.set(name, closure);
}
export function getRegisteredClosures() {
    return Array.from(closureRegistry.values());
}
export function resetClosureRegistry() {
    closureRegistry.clear();
}
//# sourceMappingURL=closureRegistry.js.map