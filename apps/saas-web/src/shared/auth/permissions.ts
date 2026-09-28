/** Doc 33 §4 — hide nav items without the minimum permission. */
export function hasPermission(
  perms: readonly string[],
  required: string | undefined,
): boolean {
  if (!required) return true;
  return perms.includes(required);
}

export interface NavPermissionItem {
  id: string;
  permission?: string;
}

export function filterNavByPermissions<T extends NavPermissionItem>(
  items: readonly T[],
  perms: readonly string[],
): T[] {
  return items.filter((item) => hasPermission(perms, item.permission));
}

/** Viewer must not see API keys or Users write surfaces. */
export function canSeeNavItem(
  perms: readonly string[],
  permission: string | undefined,
): boolean {
  return hasPermission(perms, permission);
}
