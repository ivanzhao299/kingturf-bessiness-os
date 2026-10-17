import { spawn } from 'node:child_process';

// Settle independently of child close: even an unresponsive CLI must not prevent cleanup.
export function readResponse(name, path, { launch = spawn, timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    const child = launch('docker', ['exec', '-i', name, 'nc', '-w', '2', '127.0.0.1', '8080'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let error;
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ status, stdout, stderr, error });
    };
    const abort = (message) => {
      if (settled) return;
      error = new Error(message);
      try {
        child.kill('SIGKILL');
      } finally {
        finish(null);
      }
    };
    const timer = setTimeout(() => abort('Bounded local HTTP read timeout'), timeoutMs);
    child.on('error', (failure) => {
      if (settled) return;
      error = failure;
      finish(null);
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      if (settled) return;
      stdout = (stdout + data).slice(0, 16385);
      if (stdout.length > 16384) {
        stdout = stdout.slice(0, 16384);
        abort('Bounded local HTTP response exceeded');
      }
    });
    child.stderr.on('data', (data) => {
      if (!settled) stderr = (stderr + data).slice(0, 2048);
    });
    child.stdin.on('error', () => undefined);
    child.on('close', finish);
    // BusyBox nc may exit on input EOF before draining the response; keep stdin open.
    child.stdin.write(`GET ${path} HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
  });
}
