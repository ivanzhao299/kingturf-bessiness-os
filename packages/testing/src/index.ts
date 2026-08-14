export function parseJson(payload: string): unknown {
  return JSON.parse(payload) as unknown;
}
