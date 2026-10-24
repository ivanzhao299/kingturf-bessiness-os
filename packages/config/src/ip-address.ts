function ipv4(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  if (parts.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/u.test(part) || Number(part) > 255))
    return null;
  return parts.map(Number);
}

function ipv6Words(value: string): number[] | null {
  let address = value;
  if (value.includes('.')) {
    const last = value.lastIndexOf(':');
    const bytes = ipv4(value.slice(last + 1));
    if (last < 0 || !bytes) return null;
    address =
      value.slice(0, last + 1) +
      ((bytes[0] ?? 0) * 256 + (bytes[1] ?? 0)).toString(16) +
      ':' +
      ((bytes[2] ?? 0) * 256 + (bytes[3] ?? 0)).toString(16);
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const parts = [...left, ...right];
  if (parts.some((part) => !/^[0-9a-f]{1,4}$/iu.test(part))) return null;
  const missing = 8 - parts.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 1) return null;
  return [
    ...left.map((part) => Number.parseInt(part, 16)),
    ...Array.from({ length: missing }, () => 0),
    ...right.map((part) => Number.parseInt(part, 16)),
  ];
}

function compressed(words: readonly number[]): string {
  let bestStart = -1;
  let bestLength = 1;
  for (let start = 0; start < words.length; start++) {
    if (words[start] !== 0) continue;
    let end = start;
    while (end < words.length && words[end] === 0) end++;
    if (end - start > bestLength) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end - 1;
  }
  const text = words.map((word) => word.toString(16));
  if (bestStart < 0) return text.join(':');
  return text.slice(0, bestStart).join(':') + '::' + text.slice(bestStart + bestLength).join(':');
}

export function canonicalIp(value: string): string | null {
  if (value.length > 45 || value.includes('%') || value.trim() !== value) return null;
  if (!value.includes(':')) return ipv4(value)?.join('.') ?? null;
  const words = ipv6Words(value);
  if (!words) return null;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const high = words[6] ?? 0;
    const low = words[7] ?? 0;
    return [Math.floor(high / 256), high % 256, Math.floor(low / 256), low % 256].join('.');
  }
  return compressed(words);
}
