import { canonicalIp } from '@kingturf/config';

export function loginClientAddress(
  peer: string | undefined,
  forwarded: readonly string[] | undefined,
  trusted: ReadonlySet<string>,
): string | null {
  if (peer === undefined) return 'unknown'; // Internal dispatch compatibility; transport supplies peer.
  const address = canonicalIp(peer);
  if (address === null) return null;
  if (!trusted.has(address)) return address;
  if (forwarded?.length !== 1) return null;
  const header = forwarded[0];
  if (!header || header.length > 4096) return null;
  const parts = header.split(',');
  if (parts.length > 16) return null;
  const chain = parts.map((part) => canonicalIp(part.trim()));
  if (chain.some((part) => part === null)) return null;
  for (const part of chain.reverse()) {
    if (part !== null && !trusted.has(part)) return part;
  }
  return null;
}
