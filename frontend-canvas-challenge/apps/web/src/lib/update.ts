export function updateAt<T extends { id: string }>(
  list: readonly T[],
  id: string,
  patch: (item: T) => T,
): T[] {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id !== id) continue;
    const nextItem = patch(list[i]);
    if (nextItem === list[i]) return list as T[];
    const next = list.slice();
    next[i] = nextItem;
    return next;
  }
  return list as T[];
}
