// 子进程输出脱敏（TD-TEST-023）：口令与连接串在回显前替换为掩码。逐行缓冲后整行替换，
// 因此被拆到两个数据块里的口令也不会漏出；未脱敏的输出不落盘。
import { Writable } from 'node:stream';

export const MASK = '***';
const CONNECTION_STRING = /postgres(?:ql)?:\/\/[^\s'"<>]+/giu;

export const redactText = (text, secrets) =>
  secrets.reduce(
    (current, secret) => (secret ? current.replaceAll(secret, MASK) : current),
    String(text).replace(
      CONNECTION_STRING,
      (match) => `${match.slice(0, match.indexOf('://') + 3)}${MASK}`,
    ),
  );

export function redactingWriter(destination, secrets) {
  let pending = '';
  return new Writable({
    write(chunk, _encoding, callback) {
      pending += String(chunk);
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      if (lines.length > 0)
        destination.write(`${lines.map((line) => redactText(line, secrets)).join('\n')}\n`);
      callback();
    },
    final(callback) {
      if (pending) destination.write(`${redactText(pending, secrets)}\n`);
      callback();
    },
  });
}
