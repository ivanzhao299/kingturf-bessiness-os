import { DEFAULT_API_PORT } from '@kingturf/config';
import { createServer } from 'node:http';
import { buildApp } from './app.ts';

const parsedPort = Number.parseInt(process.env.API_PORT ?? String(DEFAULT_API_PORT), 10);
const port = Number.isNaN(parsedPort) ? DEFAULT_API_PORT : parsedPort;
const app = buildApp();
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const result = app.dispatch(request.method ?? 'GET', pathname);
  response.writeHead(result.statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(result.body));
});

server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

const shutdown = (): void => {
  server.close((error) => {
    process.exit(error === undefined ? 0 : 1);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(port, '0.0.0.0');
