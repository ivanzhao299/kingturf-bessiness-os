import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export const relayFailureCodes = Object.freeze([
  'ECONNRESET',
  'EPIPE',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'CONNECT_TIMEOUT',
  'LISTENER_ERROR',
  'OTHER',
]);

// Only these two container-loopback listeners may reach the measured Docker host gateway.
export async function startForwards(
  expectedGateway,
  observe = () => {
    /* Optional fixed-category diagnostic; never receive raw messages or traffic. */
  },
) {
  const { address } = await lookup('kt-e2e-host', { family: 4 });
  assert.equal(net.isIP(expectedGateway), 4, 'numeric measured gateway required');
  assert.equal(address, expectedGateway, 'gateway identity changed');
  const sockets = new Set();
  const servers = [];
  let rejectFailure;
  const failure = new Promise((_, reject) => {
    rejectFailure = reject;
  });
  // Install a handler before the caller starts its race, without converting failure to success.
  void failure.catch(() => {
    /* The caller races the original rejection. */
  });
  let closing = false;
  const close = async () => {
    closing = true;
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(() => resolve()))),
    );
  };
  const fail = () => {
    if (!closing) rejectFailure(new Error('owned byte relay failed'));
  };
  try {
    for (const port of [4173, 5432]) {
      const server = net.createServer((downstream) => {
        const upstream = net.connect({ host: address, port });
        let connected = false;
        for (const [side, socket] of [
          ['downstream', downstream],
          ['upstream', upstream],
        ]) {
          sockets.add(socket);
          socket.once('close', () => sockets.delete(socket));
          socket.once('error', (error) => {
            observe({
              closing,
              port,
              side,
              code: relayFailureCodes.includes(error.code) ? error.code : 'OTHER',
            });
            upstream.destroy();
            downstream.destroy();
            fail();
          });
        }
        upstream.once('connect', () => {
          connected = true;
          upstream.setTimeout(0);
          downstream.pipe(upstream);
          upstream.pipe(downstream);
        });
        // A peer close cannot leave its companion socket or a PG connection behind.
        downstream.once('close', () => upstream.destroy());
        upstream.once('close', () => downstream.destroy());
        upstream.setTimeout(5_000, () => {
          observe({
            port,
            side: 'upstream',
            code: 'CONNECT_TIMEOUT',
            closing,
            socketState: {
              connected,
              connecting: upstream.connecting,
              upstreamDestroyed: upstream.destroyed,
              downstreamDestroyed: downstream.destroyed,
              activeSockets: sockets.size,
            },
          });
          upstream.destroy();
          downstream.destroy();
          fail();
        });
      });
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
      server.on('error', () => {
        observe({ port, side: 'listener', code: 'LISTENER_ERROR', closing });
        fail();
      });
    }
    return { close, failure };
  } catch (error) {
    await close();
    throw error;
  }
}
