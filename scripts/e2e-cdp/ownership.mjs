// Shared with the PowerShell cleanup predicate; match one complete CLI argument only.
export function profileArgumentPattern(profile) {
  const escaped = profile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `(?:^|\\s)(?:"--user-data-dir=${escaped}"|--user-data-dir="${escaped}")(?=\\s|$)`;
}
