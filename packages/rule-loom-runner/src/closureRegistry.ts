import type { ClosureDefinition } from 'rule-loom-engine';

const closureRegistry = new Map<string, ClosureDefinition>();

export function registerClosure(closure: ClosureDefinition) {
  const name = closure.name;
  if (!name) {
    throw new Error('Registered closure must have a name');
  }
  if (closureRegistry.has(name)) {
    throw new Error(`Closure "${name}" already registered`);
  }
  closureRegistry.set(name, closure);
}

export function getRegisteredClosures(): ClosureDefinition[] {
  return Array.from(closureRegistry.values());
}

export function resetClosureRegistry() {
  closureRegistry.clear();
}
