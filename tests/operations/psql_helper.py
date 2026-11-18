"""Tiny psql shim for rehearsal tests: run one SQL via the drill container."""
import subprocess

CONTAINER = 'kingturf-business-os-postgres-1'


def query(url, sql):
    database = url.rsplit('/', 1)[-1]
    result = subprocess.run(
        ['docker', 'exec', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
         '-U', 'kingturf', '-d', database, '-c', sql],
        capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-300:])
    return result.stdout.strip()
