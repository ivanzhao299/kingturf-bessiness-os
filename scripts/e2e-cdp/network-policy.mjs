export function classifyRequest(rawUrl, method) {
  const url = new URL(rawUrl);
  if (url.origin !== 'http://127.0.0.1:4173' || url.username || url.password) return 'blocked';
  // Vite proxy contexts are prefix matches, not path segments. Never pass /apix etc through.
  if (url.pathname.startsWith('/api')) return 'api';
  if (method !== 'GET') return 'blocked';
  if (
    url.pathname === '/' ||
    url.pathname === '/favicon.ico' ||
    url.pathname.startsWith('/assets/')
  )
    return 'static';
  return 'blocked';
}
