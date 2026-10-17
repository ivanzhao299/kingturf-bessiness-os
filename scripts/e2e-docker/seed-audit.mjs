// Private local seed child: emit only failed HTTP method/path/status, never headers/body/identity.
const original = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const target = new URL(url);
  if (target.origin !== 'http://127.0.0.1:3000')
    throw Error('seed must target the owned local API');
  const response = await original(url, init);
  if (!response.ok)
    process.stderr.write(
      `${JSON.stringify({ kind: 'seed-http-failure', method: init?.method ?? 'GET', path: target.pathname, status: response.status })}\n`,
    );
  return response;
};
