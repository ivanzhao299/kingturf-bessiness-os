#!/usr/bin/env python3
"""Verify a public HTTPS endpoint with SNI and certificate validation."""

import argparse
import json
import socket
import ssl
import time


def request(host: str, connect_host: str, path: str, timeout: float) -> tuple[int, str]:
    context = ssl.create_default_context()
    with socket.create_connection((connect_host, 443), timeout=timeout) as raw:
        with context.wrap_socket(raw, server_hostname=host) as tls:
            payload = f"GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\nAccept: application/json\r\n\r\n"
            tls.sendall(payload.encode("ascii"))
            chunks = []
            while chunk := tls.recv(65536):
                chunks.append(chunk)
    response = b"".join(chunks)
    head, _, body = response.partition(b"\r\n\r\n")
    status = int(head.split(b" ", 2)[1])
    if b"transfer-encoding: chunked" in head.lower():
        decoded = bytearray()
        while body:
            size_line, _, body = body.partition(b"\r\n")
            size = int(size_line.split(b";", 1)[0], 16)
            if size == 0:
                break
            decoded.extend(body[:size])
            body = body[size + 2 :]
        body = bytes(decoded)
    return status, body.decode("utf-8").strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--connect-host")
    parser.add_argument("--path", required=True)
    parser.add_argument("--expected", required=True)
    parser.add_argument("--attempts", type=int, default=6)
    parser.add_argument("--timeout", type=float, default=15)
    args = parser.parse_args()
    expected = json.loads(args.expected)
    connect_host = args.connect_host or args.host
    last_error = None
    for attempt in range(1, args.attempts + 1):
        try:
            status, body = request(args.host, connect_host, args.path, args.timeout)
            actual = json.loads(body)
            if status != 200 or actual != expected:
                raise RuntimeError(f"unexpected response: status={status}, body={body!r}")
            print(f"verified https://{args.host}{args.path}: status=200 body={actual}")
            return 0
        except (OSError, ssl.SSLError, ValueError, RuntimeError) as error:
            last_error = error
            print(f"attempt {attempt}/{args.attempts} failed: {error}")
            if attempt < args.attempts:
                time.sleep(5)
    raise SystemExit(f"public HTTPS verification failed: {last_error}")


if __name__ == "__main__":
    raise SystemExit(main())
