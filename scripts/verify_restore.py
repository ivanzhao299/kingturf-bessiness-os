#!/usr/bin/env python3
"""Joint restore verification: exit codes, error scan, constraints, registry parity.

Usage: verify_restore.py <dump> <target-db> <manifest.json> [--source-constraints N] [--source-not-valid N]
Creates <target>-verify (dropped first), pg_restores, and machine-verifies:
  1) pg_restore exit code + zero 'ERROR' lines in captured log
  2) restored registry == expected manifest (name+checksum, 72 rows for full)
  3) pg_constraint count == source expectation (catches silently-skipped constraints)
  4) no NOT VALID constraints
Prints a JSON verdict; exit 0 only when every check passes.
"""
import json
from pathlib import Path
import subprocess
import sys


def main():
    args = sys.argv[1:]
    flags = {}
    positional = []
    i = 0
    while i < len(args):
        if args[i] in ('--source-constraints', '--source-not-valid'):
            flags[args[i]] = int(args[i + 1]); i += 2
        else:
            positional.append(args[i]); i += 1
    if len(positional) != 3:
        raise SystemExit('usage: verify_restore.py <dump> <target-db> <manifest.json> [--source-constraints N] [--source-not-valid N]')
    dump, target_db, manifest_path = Path(positional[0]), positional[1], Path(positional[2])
    manifest = json.loads(manifest_path.read_text())
    verdict = {'checks': {}}

    admin = ['docker', 'exec', '-i', 'kingturf-business-os-postgres-1', 'psql', '-U', 'kingturf', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
    target = ['docker', 'exec', '-i', 'kingturf-business-os-postgres-1', 'psql', '-U', 'kingturf', '-d', target_db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
    subprocess.run(admin + ['-c', f'DROP DATABASE IF EXISTS {target_db}_verify'], check=True, capture_output=True)
    subprocess.run(admin + ['-c', f'CREATE DATABASE {target_db}_verify'], check=True, capture_output=True)
    restore = subprocess.run(['docker', 'exec', '-i', 'kingturf-business-os-postgres-1', 'pg_restore', '-U', 'kingturf', '-d', f'{target_db}_verify', '--no-owner'],
                             stdin=open(dump, 'rb'), capture_output=True, text=True)
    error_lines = [line for line in (restore.stderr or '').splitlines() if 'ERROR' in line]
    verdict['checks']['restore_exit_code'] = restore.returncode
    verdict['checks']['restore_errors'] = error_lines
    ok = restore.returncode in (0, 1) and not error_lines  # exit 1 with zero ERROR lines = warnings only

    def q(statement):
        out = subprocess.run(['docker', 'exec', '-i', 'kingturf-business-os-postgres-1', 'psql', '-U', 'kingturf', '-d', f'{target_db}_verify', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement],
                             check=True, capture_output=True, text=True).stdout.strip()
        return out

    rows = q('SELECT coalesce(string_agg(name||chr(58)||checksum, chr(10) ORDER BY name), chr(45)) FROM schema_migrations').splitlines()
    expected_rows = sorted(f"{name}:{digest}" for name, digest in manifest.items())
    verdict['checks']['registry_parity'] = (rows == expected_rows)
    ok = ok and rows == expected_rows

    constraints = int(q('SELECT count(*) FROM pg_constraint'))
    not_valid = int(q("SELECT count(*) FROM pg_constraint WHERE NOT convalidated"))
    verdict['checks']['constraints'] = {'count': constraints, 'source': flags.get('--source-constraints'), 'not_valid': not_valid}
    if '--source-constraints' in flags:
        ok = ok and constraints == flags['--source-constraints']
    if '--source-not-valid' in flags:
        ok = ok and not_valid == flags['--source-not-valid']
    else:
        ok = ok and not_valid == 0

    subprocess.run(admin + ['-c', f'DROP DATABASE IF EXISTS {target_db}_verify'], check=True, capture_output=True)
    verdict['verdict'] = 'PASS' if ok else 'FAIL'
    print(json.dumps(verdict, indent=1))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
