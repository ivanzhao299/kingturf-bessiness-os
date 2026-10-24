export const hasPermissionPrefix = (
  permissions: ReadonlySet<string>,
  prefixes: readonly string[],
) =>
  [...permissions].some((permission) => prefixes.some((prefix) => permission.startsWith(prefix)));
