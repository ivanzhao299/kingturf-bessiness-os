#!/usr/bin/env python3
"""TD-REL-006: sanctioned legacy outbox disposal + Wave2 staged cleanup.

Two fail-closed modes, dispatched via .github/workflows/ops-maintenance.yml:

  dispose-legacy-outbox  Insert one DEAD_LETTER event_consumer_deliveries row
                         (consumer td-rel-006.legacy-seed-disposal, attempts=0)
                         per seed-era undelivered outbox event, in ONE parameterized
                         transaction. No UPDATE/DELETE anywhere. Precheck aborts on
                         any drift from the expected exactly-164 set; postcheck
                         asserts the legacy undelivered count is zero.
  cleanup-staged         Whitelist-exactly-7 Wave2 staged directories under /tmp,
                         each verified to contain only the expected control shape
                         before removal. Any unexpected entry skips (reports, keeps)
                         that directory. Paths touching .release-backups or
                         .release-image-recovery are hard-refused.

Schema basis: event_consumer_deliveries (0011) — id/tenant_id/consumer_name/state/
attempts/available_at NOT NULL with defaults; lease_until/claimed_by/last_error_code/
delivered_at nullable; UNIQUE(tenant_id,consumer_name,event_id); claim_token (0014).
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

EXPECTED_LEGACY_COUNT = 164
LEGACY_CUTOFF = '2026-10-11'
CONSUMER = 'td-rel-006.legacy-seed-disposal'
STAGED_WHITELIST = (
    '/tmp/wave2-44345815689-1',
    '/tmp/wave2-44349676349-1',
    '/tmp/wave2-44352226506-1',
    '/tmp/wave2-44354803928-1',
    '/tmp/wave2-44357426101-1',
    '/tmp/wave2-44359813902-1',
    '/tmp/wave2-44362962206-1',
)
STAGED_EXPECTED_ENTRIES = ('migrations', 'production_preflight.py', 'release_orchestrator.py')
FORBIDDEN_PATH_MARKERS = ('.release-backups', '.release-image-recovery')


def emit(step, payload, status='PASS'):
    line = {'step': step, 'status': status,
            'at_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    line.update(payload)
    print(json.dumps(line, sort_keys=True), flush=True)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def parse_postgres_env(env_text):
    values = {}
    for line in env_text.splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, _, value = line.partition('=')
            values[key.strip()] = value.strip()
    user, db = values.get('POSTGRES_USER'), values.get('POSTGRES_DB')
    require(user and db, '.env.production must define POSTGRES_USER and POSTGRES_DB')
    return user, db


def psql(prod_root, user, db, sql, container='kingturf-erp-production-postgres-1'):
    result = subprocess.run(
        ['docker', 'exec', '-i', container, 'psql', '-X', '-qAt',
         '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', '-U', user, '-d', db],
        input=sql.encode(), capture_output=True, timeout=300)
    require(result.returncode == 0, 'psql failed: ' + result.stderr.decode()[-400:])
    return result.stdout.decode()


def legacy_ids_sql():
    return ("SELECT o.id::text FROM domain_event_outbox o WHERE NOT EXISTS"
            "(SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id"
            " AND d.tenant_id=o.tenant_id)")


# ------------------------------------------------- pure pieces (unit-testable)


def classify_drift(actual_ids, expected_count):
    """Return (ok, summary) — exact-count match required, else first-20 diff lists."""
    ids = [line.strip() for line in actual_ids.splitlines() if line.strip()]
    if len(ids) == expected_count:
        return True, {'count': len(ids)}
    return False, {'actual': len(ids), 'expected': expected_count,
                   'sample': ids[:20]}


def staged_entry_ok(names):
    """Exactly the expected control shape; anything else is unexpected."""
    return sorted(names) == sorted(STAGED_EXPECTED_ENTRIES)


def refuse_forbidden(path):
    marker = next((m for m in FORBIDDEN_PATH_MARKERS if m in str(path)), None)
    require(marker is None, f'refusing path touching {marker}: {path}')


# ------------------------------------------------------------ host modes


def mode_dispose(prod_root):
    user, db = parse_postgres_env((prod_root / '.env.production').read_text())
    step = 'precheck'
    all_legacy = psql(prod_root, user, db, legacy_ids_sql() + ';')
    ok, summary = classify_drift(all_legacy, EXPECTED_LEGACY_COUNT)
    require(ok, f'legacy set drift ({json.dumps(summary)}) — aborting before any write')
    legacy_cutoff = psql(prod_root, user, db,
                         f"SELECT count(*) FROM domain_event_outbox o WHERE o.created_at < '{LEGACY_CUTOFF}'"
                         ' AND NOT EXISTS(SELECT 1 FROM event_consumer_deliveries d'
                         ' WHERE d.event_id=o.id AND d.tenant_id=o.tenant_id);').strip()
    require(legacy_cutoff == str(EXPECTED_LEGACY_COUNT),
            f'legacy set is not entirely pre-cutoff ({legacy_cutoff} != {EXPECTED_LEGACY_COUNT})')
    emit('precheck', {'legacy_undelivered': EXPECTED_LEGACY_COUNT, 'cutoff': LEGACY_CUTOFF})

    step = 'dispose'
    # Single transaction, parameterized per-event INSERT from the live set itself:
    # no id list ever crosses a boundary; a UNIQUE conflict aborts the whole txn.
    sql = (
        'BEGIN;\n'
        'INSERT INTO event_consumer_deliveries(id,tenant_id,consumer_name,event_id,state,attempts)\n'
        f" SELECT gen_random_uuid(),o.tenant_id,'{CONSUMER}',o.id,'DEAD_LETTER',0\n"
        ' FROM domain_event_outbox o WHERE NOT EXISTS'
        ' (SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id AND d.tenant_id=o.tenant_id);\n'
        'COMMIT;\n')
    psql(prod_root, user, db, sql)
    emit('dispose', {'consumer': CONSUMER, 'state': 'DEAD_LETTER'})

    step = 'postcheck'
    remaining = psql(prod_root, user, db,
                     'SELECT count(*) FROM (' + legacy_ids_sql() + ') probe;').strip()
    require(remaining == '0', f'legacy undelivered remains: {remaining}')
    disposed = psql(prod_root, user, db,
                    f"SELECT count(*) FROM event_consumer_deliveries WHERE consumer_name='{CONSUMER}';").strip()
    ids = sorted(line.strip() for line in all_legacy.splitlines() if line.strip())
    emit('postcheck', {'legacy_undelivered': 0, 'disposed': int(disposed),
                       'id_first': ids[0] if ids else None,
                       'id_last': ids[-1] if ids else None,
                       'cutoff': LEGACY_CUTOFF})


def mode_cleanup_staged():
    step = 'cleanup-staged'
    results = []
    for directory in STAGED_WHITELIST:
        path = Path(directory)
        refuse_forbidden(path)
        if not path.is_dir():
            results.append({'path': directory, 'action': 'missing (already clean)'})
            continue
        entries = sorted(p.name for p in path.iterdir())
        if not staged_entry_ok(entries):
            results.append({'path': directory, 'action': 'SKIPPED unexpected entries',
                            'entries': entries})
            continue
        subprocess.run(['rm', '-rf', directory], check=True, timeout=120)
        results.append({'path': directory, 'action': 'removed'})
    skipped = [r for r in results if 'SKIPPED' in r['action']]
    emit('cleanup-staged', {'directories': results, 'skipped': len(skipped)})
    require(not skipped, 'one or more staged directories were skipped unexpectedly')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('dispose-legacy-outbox', 'cleanup-staged'))
    parser.add_argument('--prod-root', default='/data/kingturf-erp', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    step = 'start'
    try:
        if args.mode == 'dispose-legacy-outbox':
            mode_dispose(args.prod_root)
        else:
            mode_cleanup_staged()
        emit('done', {'mode': args.mode})
    except Exception as failure:  # noqa: BLE001 - single fail-closed report path
        emit(step, {'error': str(failure)[:500]}, status='FAIL')
        sys.exit(1)


if __name__ == '__main__':
    main()
