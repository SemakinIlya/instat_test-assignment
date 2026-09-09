import type { EdgeChange, NodeChange } from '@xyflow/react';

/** RF select/measure are local — not part of PUT. */
export function nodeChangesPersist(changes: readonly NodeChange[]): boolean {
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change.type === 'remove' || change.type === 'add' || change.type === 'replace') return true;
    if (change.type === 'position') return true;
  }
  return false;
}

export function edgeChangesPersist(changes: readonly EdgeChange[]): boolean {
  for (let i = 0; i < changes.length; i++) {
    const type = changes[i].type;
    if (type === 'remove' || type === 'add' || type === 'replace') return true;
  }
  return false;
}
