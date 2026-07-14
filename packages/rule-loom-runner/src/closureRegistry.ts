import { canonicalClosureName, type ClosureDefinition } from 'rule-loom-engine';

const closureRegistry = new Map<string, ClosureDefinition>();

export function registerClosure(closure: ClosureDefinition) {
  const name = canonicalClosureName(closure);
  if (!name) {
    throw new Error('Registered closure must have a name');
  }
  if (closureRegistry.has(name)) {
    throw new Error(`Closure "${name}" already registered`);
  }
  closureRegistry.set(name, name === closure.name ? closure : { ...closure, name });
}

export function getRegisteredClosures(): ClosureDefinition[] {
  return Array.from(closureRegistry.values());
}

export function resetClosureRegistry() {
  closureRegistry.clear();
}
