// Run inside the pinned Docker image with kt-e2e-host:host-gateway; no DB credentials.
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { test } from 'node:test';
import { startForwards } from './forward.mjs';

const gateway = (await lookup('kt-e2e-host', { family: 4 })).address;
const listen = async (port) => {
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
};
const close = (server) => new Promise((resolve) => server.close(resolve));

test('unknown numeric gateway is rejected without creating listeners', async () => {
  await assert.rejects(startForwards('203.0.113.1'), /gateway identity changed/u);
  for (const port of [4173, 5432]) {
    const server = await listen(port);
    await close(server);
  }
});
for (const port of [4173, 5432])
  test(`occupied ${port} fails without closing its foreign owner`, async () => {
    const foreign = await listen(port);
    try {
      await assert.rejects(startForwards(gateway));
      assert(foreign.listening);
      const other = await listen(port === 4173 ? 5432 : 4173);
      await close(other);
    } finally {
      await close(foreign);
    }
  });
test('refused host preview is a failed relay and closes all owned listeners', async () => {
  // The runner requires no host preview/API during this negative test.
  const relay = await startForwards(gateway);
  const socket = net.connect({ host: '127.0.0.1', port: 4173 });
  socket.on('error', () => {
    /* Expected peer destruction. */
  });
  try {
    await assert.rejects(
      Promise.race([
        relay.failure,
        new Promise((_, reject) => setTimeout(() => reject(Error('negative deadline')), 7000)),
      ]),
      /owned byte relay failed/u,
    );
  } finally {
    socket.destroy();
    await relay.close();
  }
  for (const port of [4173, 5432]) {
    const server = await listen(port);
    await close(server);
  }
});
