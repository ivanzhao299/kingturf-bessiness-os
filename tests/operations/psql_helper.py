"""Tiny psql shim for rehearsal tests: run one SQL via the drill container.

Without a host psql client the drills reach PostgreSQL through `docker exec`. The
container is resolved from DATABASE_URL: a run pointed at another loopback port (an
isolated CI container, say) must not keep talking to the compose service, or the
Python side and the Node migrator end up on two different instances and concurrent
runs share drill databases.
"""
import os
import re
import shutil
import subprocess
from urllib.parse import urlparse

COMPOSE_CONTAINER = 'kingturf-business-os-postgres-1'


def container_for(url):
    """Container that serves the host port of a loopback DATABASE_URL, or None.

    The compose port (5432, or no URL at all) keeps the compose service name without
    asking Docker, so existing setups behave exactly as before. Any other port is
    looked up among the running containers; None means "no such container" and the
    drills skip instead of silently mixing two instances.
    """
    port = urlparse(url or '').port or 5432
    if port == 5432:
        return COMPOSE_CONTAINER
    if shutil.which('docker') is None:
        return None
    listed = subprocess.run(
        ['docker', 'ps', '--filter', f'publish={port}', '--format', '{{.Names}}\t{{.Ports}}'],
        capture_output=True, text=True, timeout=30)
    if listed.returncode != 0:
        return None
    names = [line.partition('\t')[0].strip() for line in listed.stdout.splitlines()
             if re.search(rf':{port}->', line)]
    return names[0] if len(names) == 1 else None


def user_for(url):
    return urlparse(url or '').username or 'kingturf'


ENV_URL = os.environ.get('DATABASE_URL')
CONTAINER = container_for(ENV_URL)
PG_USER = user_for(ENV_URL)


def query(url, sql):
    database = url.rsplit('/', 1)[-1]
    result = subprocess.run(
        ['docker', 'exec', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
         '-U', PG_USER, '-d', database, '-c', sql],
        capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-300:])
    return result.stdout.strip()
