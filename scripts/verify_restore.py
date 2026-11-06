#!/usr/bin/env python3
"""Joint restore verification: exit codes, error scan, constraints, registry parity.

Usage: verify_restore.py <dump> <target-db> <manifest.json> [--source-constraints N] [--source-not-valid N]
Creates <target>-verify (dropped first), pg_restores, and machine-verifies:
  1) pg_restore exit code + zero 'ERROR' lines in captured log
  2) restored registry == expected manifest (name+checksum, 72 rows for full)
  3) pg_constraint count == source expectation (catches silently-skipped constraints)
  4) not-valid constraint count == source expectation (17 for the 72-migration DB)
Prints a JSON verdict; exit 0 only when every check passes.
"""
import json
from pathlib import Path
import re
import subprocess
import sys

IDENTIFIER = re.compile(r'[a-z_][a-z0-9_]*')


def parse_args(args):
    flags = {}
    positional = []
    i = 0
    while i < len(args):
        if args[i] in ('--source-constraints', '--source-not-valid'):
            if i + 1 >= len(args) or not re.fullmatch(r'[0-9]+', args[i + 1]):
                raise SystemExit('usage: verify_restore.py <dump> <target-db> <manifest.json> [--source-constraints N] [--source-not-valid N]')
            flags[args[i]] = int(args[i + 1]); i += 2
        else:
            positional.append(args[i]); i += 1
    if len(positional) != 3:
        raise SystemExit('usage: verify_restore.py <dump> <target-db> <manifest.json> [--source-constraints N] [--source-not-valid N]')
    return positional, flags


def main():
    try:
        (dump, target_db, manifest_path), flags = parse_args(sys.argv[1:])
        dump, manifest_path = Path(dump), Path(manifest_path)
        # target_db is interpolated into SQL identifiers; only plain lowercase
        # identifiers are ever accepted (red line: no arbitrary concatenation).
        if not IDENTIFIER.fullmatch(target_db):
            raise SystemExit(f'refusing non-identifier target database name: {target_db!r}')
        if not dump.is_file():
            raise SystemExit(f'dump file not found: {dump}')
        manifest = json.loads(manifest_path.read_text())
        verdict = run(dump, target_db, manifest, flags)
    except SystemExit as stop:
        print(json.dumps({'verdict': 'FAIL', 'error': str(stop)}, indent=1))
        raise
    except Exception as error:  # catastrophic failures must still yield a JSON verdict
        print(json.dumps({'verdict': 'FAIL', 'error': f'{type(error).__name__}: {error}'}, indent=1))
        sys.exit(1)
    print(json.dumps(verdict, indent=1))
    sys.exit(0 if verdict['verdict'] == 'PASS' else 1)


def run(dump, target_db, manifest, flags):
    verdict = {'checks': {}}
    container = 'kingturf-business-os-postgres-1'
    verify_db = f'{target_db}_verify'
    admin = ['docker', 'exec', '-i', container, 'psql', '-U', 'kingturf', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']

    def cleanup():
        subprocess.run(admin + ['-c', f'DROP DATABASE IF EXISTS {verify_db}'], check=True, capture_output=True)

    ok = True
    try:
        cleanup()
        subprocess.run(admin + ['-c', f'CREATE DATABASE {verify_db}'], check=True, capture_output=True)
        restore = subprocess.run(['docker', 'exec', '-i', container, 'pg_restore', '-U', 'kingturf', '-d', verify_db, '--no-owner'],
                                 stdin=open(dump, 'rb'), capture_output=True, text=True)
        # Server-side failures log uppercase 'ERROR:' severity (never localized);
        # client-side pg_restore failures log 'pg_restore: error:' instead.
        error_lines = [line for line in (restore.stderr or '').splitlines() if 'ERROR' in line or line.startswith('pg_restore: error:')]
        verdict['checks']['restore_exit_code'] = restore.returncode
        verdict['checks']['restore_errors'] = error_lines
        ok = restore.returncode in (0, 1) and not error_lines  # exit 1 with zero error lines = warnings only

        def q(statement):
            out = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-U', 'kingturf', '-d', verify_db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement],
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
    finally:
        # Always drop the scratch database, even on catastrophic failure paths.
        cleanup()
    verdict['verdict'] = 'PASS' if ok else 'FAIL'
    return verdict


if __name__ == '__main__':
    main()
