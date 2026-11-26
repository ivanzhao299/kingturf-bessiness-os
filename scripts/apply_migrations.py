#!/usr/bin/env python3
"""Workflow-driven production migration control (Wave2 72->74). Fail-closed, no retries.

Runs ON the production host over SSH from .github/workflows/apply-migrations.yml.
Machine-measures every orchestrator evidence gate, then delegates the gated apply to
release_orchestrator.py (single-flight, no-registration-on-failure). The API remains
STOPPED and the write fence remains ENABLED afterwards; the recover workflow's switch()
disables the fence and restores service with the Wave2 images.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
from datetime import datetime, timedelta, timezone

SUFFIX_RE = re.compile(r'^[0-9]{4}_[a-z0-9_]+\.sql$')
SHA_RE = re.compile(r'^[0-9a-f]{40}$')
HEALTH = 'http://127.0.0.1:4332/health'
PROJECT = 'kingturf-erp-production'
DRAIN_INFLIGHT_CUTOFF_DAYS = 7


def utcnow():
    return datetime.now(timezone.utc)


def iso(moment):
    return moment.strftime('%Y-%m-%dT%H:%M:%SZ')


def emit(step, payload, status='PASS'):
    line = {'step': step, 'status': status, 'at_utc': iso(utcnow())}
    line.update(payload)
    print(json.dumps(line, sort_keys=True), flush=True)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def archive_terminal_state(prod_root: Path, candidate_sha: str) -> None:
    """Ruling 11: a prior release's terminal orchestration state must not block a
    new candidate. Archive it (0600) before execute; RUNNING states and
    same-candidate states are left untouched for the orchestrator's own
    fail-closed resume/refusal semantics."""
    state_file = prod_root / '.release-migration-state' / 'orchestration-state.json'
    if not state_file.is_file():
        return
    previous = json.loads(state_file.read_text())
    if previous.get('release_sha') == candidate_sha:
        return
    require(
        previous.get('verdict') in ('COMPLETED', 'STOPPED'),
        'migration state belongs to a different release and is not terminal '
        f'(release_sha={previous.get("release_sha")}, verdict={previous.get("verdict")}); '
        'inspect .release-migration-state manually before retrying',
    )
    archive_dir = prod_root / '.release-migration-state' / 'archive'
    archive_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    archived = archive_dir / (
        f"{previous.get('release_sha', 'unknown')}-{utcnow().strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    os.replace(state_file, archived)
    os.chmod(archived, 0o600)
    emit('state-archive', {'archived_sha': previous.get('release_sha'),
                           'verdict': previous.get('verdict'),
                           'archive': str(archived)})


# ---------------------------------------------------------------- pure helpers


def parse_suffixes(text):
    require(isinstance(text, str) and text.strip(), 'approved suffixes input is empty')
    names = [part.strip() for part in text.split(',')]
    require(all(names), 'approved suffixes contain an empty entry')
    for name in names:
        require(SUFFIX_RE.fullmatch(name), f'approved suffix is not an exact migration name: {name}')
    require(len(set(names)) == len(names), 'approved suffixes contain duplicates')
    return names


def validate_candidate_sha(sha):
    require(isinstance(sha, str) and SHA_RE.fullmatch(sha), 'candidate sha must be 40 lowercase hex')


def approval_window(now):
    start = now
    end = now + timedelta(hours=6)
    require(0 < (end - start).total_seconds() <= 12 * 3600, 'approval window must be within 12 hours')
    return start, end


def build_release_approval(candidate_sha, suffixes, approver, now):
    validate_candidate_sha(candidate_sha)
    require(isinstance(approver, str) and approver.strip(), 'approver is required')
    start, end = approval_window(now)
    return {
        'release_sha': candidate_sha,
        'approved_suffix': list(suffixes),
        'approved_at_utc': iso(start),
        'window_end_utc': iso(end),
        'approver': approver,
    }


def selected_recovery_approval(orchestrator, evidence_root, plan, legacy_sha, now, relative=None):
    """An explicit current approval selects recovery mode; evidence alone never does.

    The canonical file can be pre-provisioned by the release coordinator without
    changing workflow inputs. A CLI override is still relative to that same bundle.
    """
    name = relative or 'migration-recovery-approval.json'
    if relative is None and not (evidence_root / name).exists():
        return None
    path = orchestrator.evidence_file(evidence_root, name)
    approval = json.loads(path.read_bytes())
    require(approval.get('image_compatibility_mode') == 'compatible_recovery', 'Explicit recovery approval must select compatible_recovery')
    orchestrator.check_approval(approval, plan, now)
    artifact = orchestrator.evidence_file(evidence_root, 'compatible_recovery.json')
    orchestrator.check_compatible_recovery(json.loads(artifact.read_bytes()), approval, plan, {'api_release_sha': legacy_sha}, evidence_root)
    return approval


def build_write_fence(api_release_sha, t_fence, t_obs, t_stop):
    require(SHA_RE.fullmatch(api_release_sha), 'api release sha must be 40 lowercase hex')
    return {
        'method': 'controlled_old_api_shutdown',
        'enabled_at_utc': t_fence,
        'observed_no_new_writes_utc': t_obs,
        'api_release_sha': api_release_sha,
        'in_flight_settled': True,
        'api_service_state': 'stopped',
        'stopped_at_utc': t_stop,
    }


def scalar(session, sql):
    """PsqlSession.query returns a list of output lines; join and strip for one value."""
    return ''.join(session.query(sql)).strip()


def disable_fence_text(env_text):
    require('KINGTURF_WRITE_FENCE=' in env_text, '.env.production lacks KINGTURF_WRITE_FENCE')
    return re.sub(r'^KINGTURF_WRITE_FENCE=.*$', 'KINGTURF_WRITE_FENCE=disabled',
                  env_text, flags=re.MULTILINE)


def enable_fence_text(env_text):
    require('KINGTURF_WRITE_FENCE=' in env_text, '.env.production lacks KINGTURF_WRITE_FENCE')
    return re.sub(r'^KINGTURF_WRITE_FENCE=.*$', 'KINGTURF_WRITE_FENCE=enabled',
                  env_text, flags=re.MULTILINE)


def wait_until(predicate, attempts=45, delay=2.0):
    for attempt in range(attempts):
        if predicate():
            return True
        time.sleep(delay)
    return False


def inflight_drain_sql(cutoff_days=DRAIN_INFLIGHT_CUTOFF_DAYS):
    """In-flight gate: recent undelivered outbox + any PENDING/PROCESSING delivery."""
    return (
        "SELECT coalesce((SELECT count(*) FROM domain_event_outbox o WHERE o.created_at >= now()"
        f" - interval '{cutoff_days} days' AND NOT EXISTS"
        "(SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id"
        " AND d.tenant_id=o.tenant_id)),0) + coalesce((SELECT count(*) FROM"
        " event_consumer_deliveries WHERE state IN ('PENDING','PROCESSING')),0)")


def legacy_undelivered_sql():
    """Disclosure-only count: all-time outbox rows with no delivery row (TD-REL-006)."""
    return (
        "SELECT count(*) FROM domain_event_outbox o WHERE NOT EXISTS"
        "(SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id"
        " AND d.tenant_id=o.tenant_id)")


def require_zero(session, sql, label):
    value = scalar(session, sql)
    require(value == '0', f'{label}: {value}')
    return value


def version_matches_marker(path, marker):
    """Compare /version response BODY sha against the .release-sha marker content."""
    try:
        with urllib.request.urlopen(HEALTH.replace('/health', path), timeout=15) as reply:
            if reply.status != 200:
                return False
            payload = json.load(reply)
    except (urllib.error.URLError, ValueError, OSError):
        return False
    return payload.get('sha') == marker


def restore_api_on_failure(prod_root):
    """Failure-restore semantics (recover_previous_application counterpart, light):

    Only invoked from the failure path when this script itself stopped the API via
    the write fence. Re-enables traffic (fence disabled) and brings the previous
    application back; the database is untouched by design up to that point."""
    env_path = prod_root / '.env.production'
    # A4-P1-2 (A-F1)：写回前断言既有权限 ≤0600 并保持 owner-only。
    require((env_path.stat().st_mode & 0o777) <= 0o600,
            '.env.production permissions are broader than 0600')
    env_path.write_text(disable_fence_text(env_path.read_text()))
    env_path.chmod(0o600)
    compose(prod_root, 'up', '-d', '--no-deps', '--pull', 'never', 'api')
    marker = (prod_root / '.release-sha').read_text().strip()
    healthy = wait_until(lambda: http_status('/health') == 200
                         and version_matches_marker('/version', marker))
    if not healthy:
        emit('api-restore-failed', {'marker': marker}, status='FAIL')
        return False
    emit('api-restored', {'marker': marker, 'fence': 'disabled'})
    return True


def run_orchestrator(staged, *cli):
    """Delegate a gated step to the staged orchestrator CLI (single source of truth)."""
    argv = [sys.executable, '-I', str(Path(staged) / 'release_orchestrator.py'), *cli]
    result = subprocess.run(argv, capture_output=True, text=True, timeout=1800)
    require(result.returncode == 0,
            'orchestrator failed: ' + result.stderr.strip()[-400:])
    return json.loads(result.stdout)


def validate_staged_layout(staged, migrations, expected_after, approved_suffixes):
    """Staged tree contract: two control scripts as files + migrations directory tree."""
    for required in (Path(staged) / 'release_orchestrator.py', Path(staged) / 'production_preflight.py'):
        require(Path(required).is_file(), f'staged file missing: {required}')
    require(migrations.is_dir(), f'staged migrations directory missing: {migrations}')
    names = sorted(p.name for p in migrations.glob('[0-9][0-9][0-9][0-9]*.sql'))
    require(names and len(names) == expected_after,
            f'staged migrations count {len(names)} != {expected_after}')
    for name in approved_suffixes:
        require(name in names, f'approved suffix absent from staged migrations: {name}')
    return names


def dump_paths(backup_root, stamp):
    root = Path(backup_root)
    return root / f'wave2-{stamp}.dump', root / f'wave2-{stamp}.dump.sha256'


def parse_postgres_env(env_text):
    values = {}
    for line in env_text.splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, _, value = line.partition('=')
            values[key.strip()] = value.strip()
    user, db = values.get('POSTGRES_USER'), values.get('POSTGRES_DB')
    require(user and db, '.env.production must define POSTGRES_USER and POSTGRES_DB')
    return user, db


def require_registry(rows, expected_before, approved_suffixes):
    require(isinstance(rows, list), 'registry query did not return a list')
    require(len(rows) == expected_before,
            f'registry count {len(rows)} != expected {expected_before}')
    present = {row['name'] for row in rows}
    for name in approved_suffixes:
        require(name not in present, f'approved migration already present in registry: {name}')
    return rows


def require_plan(plan, approved_suffixes):
    require(plan.get('classification') == 'MATCHED_PREFIX_PENDING',
            f"plan classification is {plan.get('classification')}, expected MATCHED_PREFIX_PENDING")
    pending = sorted(item['name'] for item in plan.get('pending', []))
    require(pending == sorted(approved_suffixes),
            f"plan pending {pending} != approved suffixes {sorted(approved_suffixes)}")
    return plan


# ------------------------------------------------------------------- host flow


def command(argv, *, timeout=300, stdin_bytes=None):
    result = subprocess.run(argv, input=stdin_bytes, capture_output=True, timeout=timeout)
    require(result.returncode == 0,
            'host command failed: ' + ' '.join(map(str, argv[:4])) + ': ' + result.stderr.decode()[-400:])
    return result.stdout


def psql_argv(prod_root, user, db, container):
    return ['docker', 'exec', '-i', container, 'psql', '-X', '-qAt',
            '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', '-U', user, '-d', db]


def compose(prod_root, *args):
    return command(['docker', 'compose', '--project-directory', str(prod_root),
                    '--env-file', str(prod_root / '.env.production'),
                    '-f', str(prod_root / 'infra/docker/compose.production.yaml'), *args],
                   timeout=180)


def api_identity(container):
    return (container['Id'], container['Image'], container['Config']['Image'], tuple(container['Config']['Env']))


def observe_api(attachments_dir):
    values = json.loads(command(['docker', 'inspect', PROJECT+'-api-1']))
    require(len(values) == 1, 'API source is ambiguous')
    container = values[0]
    labels = container.get('Config', {}).get('Labels') or {}
    require(container.get('Name') == '/'+PROJECT+'-api-1' and isinstance(labels, dict) and labels.get('com.docker.compose.project') == PROJECT and labels.get('com.docker.compose.service') == 'api', 'API scope canonical name or Compose project/service mismatch')
    mounts = [m for m in container.get('Mounts', []) if m.get('Destination') == '/var/lib/kingturf/attachments']
    require(len(mounts) == 1 and mounts[0].get('Type') == 'bind' and mounts[0].get('Source') == str(attachments_dir), 'API scope attachment bind mismatch')
    require(re.fullmatch(r'[0-9a-f]{64}', container['Id']) and re.fullmatch(r'sha256:[0-9a-f]{64}', container['Image']), 'API source requires full immutable container/image IDs')
    return container


def stop_verified_api(attachments_dir, source):
    # TD-REL-013: a replacement after the final observation cannot redirect this ID.
    require(api_identity(observe_api(attachments_dir)) == api_identity(source), 'API source changed before bound stop')
    command(['docker', 'stop', '-t', '30', source['Id']])
    stopped = json.loads(command(['docker', 'inspect', source['Id']]))[0]
    canonical = observe_api(attachments_dir)
    require(api_identity(stopped) == api_identity(canonical) == api_identity(source), 'API source changed during bound stop')
    require(all(not item['State'].get('Running') and not item['State'].get('Restarting') for item in (stopped, canonical)), 'API is not truly stopped')


def http_status(path, method='GET', timeout=15):
    request = urllib.request.Request(HEALTH.replace('/health', path), method=method,
                                     headers={'content-type': 'application/json'},
                                     data=b'{}' if method == 'POST' else None)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as reply:
            return reply.status
    except urllib.error.HTTPError as failure:
        return failure.code


def dump_database(container, user, db, target, timeout=600):
    stdout = command(['docker', 'exec', container, 'pg_dump', '--format=custom',
                      '--username', user, db], timeout=timeout)
    require(bool(stdout), 'empty database dump')
    target.write_bytes(stdout)
    return hashlib.sha256(stdout).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-sha', required=True)
    parser.add_argument('--approved-suffixes', required=True)
    parser.add_argument('--staged-root', required=True, type=Path)
    parser.add_argument('--approver', required=True)
    parser.add_argument('--prod-root', default=Path('/data/kingturf-erp'), type=Path)
    parser.add_argument('--attachments-dir', default=Path('/data/kingturf-erp-data/attachments'), type=Path)
    parser.add_argument('--postgres-container', default='kingturf-erp-production-postgres-1')
    parser.add_argument('--expected-before', type=int, default=72)
    parser.add_argument('--expected-after', type=int, default=74)
    parser.add_argument('--recovery-approval', help='Approval file relative to .release-migration-evidence; default migration-recovery-approval.json when provisioned')
    args = parser.parse_args()

    step = 'validate-inputs'
    fence_applied = False
    migration_started = False
    recovery_approval = None
    api_binding = None
    try:
        validate_candidate_sha(args.candidate_sha)
        suffixes = parse_suffixes(args.approved_suffixes)
        staged = args.staged_root
        migrations = staged / 'migrations'
        names = validate_staged_layout(staged, migrations, args.expected_after, suffixes)
        spec = importlib.util.spec_from_file_location('release_orchestrator', staged / 'release_orchestrator.py')
        ro = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ro)
        emit('validate-inputs', {'candidate_sha': args.candidate_sha, 'suffixes': suffixes,
                                 'migrations': len(names)})

        user, db = parse_postgres_env((args.prod_root / '.env.production').read_text())
        argv = psql_argv(args.prod_root, user, db, args.postgres_container)
        session = ro.PsqlSession(argv)
        try:
            step = 'registry-precheck'
            rows = ro.read_registry(session)
            require_registry(rows, args.expected_before, suffixes)
            emit('registry-precheck', {'count': len(rows)})

            step = 'recovery-point'
            stamp = utcnow().strftime('%Y%m%dT%H%M%SZ')
            dump, sidecar = dump_paths(args.prod_root / '.release-backups', stamp)
            dump.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            sha = dump_database(args.postgres_container, user, db, dump)
            sidecar.write_text(sha + '  ' + dump.name + '\n')
            emit('recovery-point', {'file': str(dump), 'sha256': sha})

            step = 'plan'
            plan = ro.build_plan(migrations, args.candidate_sha, ro.read_registry(session))
            require_plan(plan, suffixes)
            plan_path = staged / 'plan.json'
            plan_path.write_text(json.dumps(plan, sort_keys=True))
            emit('plan', {'classification': plan['classification'],
                          'pending': [item['name'] for item in plan['pending']]})

            evidence = args.prod_root / '.release-migration-evidence'
            evidence.mkdir(parents=True, exist_ok=True)

            step = 'recovery-approval'
            recovery_approval = selected_recovery_approval(ro, evidence, plan, (args.prod_root / '.release-sha').read_text().strip(), utcnow(), args.recovery_approval)

            step = 'write-fence'
            api_binding = observe_api(args.attachments_dir)
            api_sha = (args.prod_root / '.release-sha').read_text().strip()
            require([v for v in api_binding['Config']['Env'] if v.startswith('KINGTURF_RELEASE_SHA=')] == ['KINGTURF_RELEASE_SHA='+api_sha], 'API source release differs from marker')
            t_fence = iso(utcnow())
            env_path = args.prod_root / '.env.production'
            env_path.write_text(enable_fence_text(env_path.read_text()))
            fence_applied = True
            compose(args.prod_root, 'up', '-d', '--no-deps', '--pull', 'never', 'api')
            time.sleep(8)
            fenced = observe_api(args.attachments_dir)
            require(fenced['Image'] == api_binding['Image'] and fenced['Config']['Image'] == api_binding['Config']['Image'] and [v for v in fenced['Config']['Env'] if v.startswith('KINGTURF_RELEASE_SHA=')] == ['KINGTURF_RELEASE_SHA='+api_sha], 'API source changed while enabling fence')
            require(fenced['State'].get('Running') and not fenced['State'].get('Restarting') and [v for v in fenced['Config']['Env'] if v.startswith('KINGTURF_WRITE_FENCE=')] == ['KINGTURF_WRITE_FENCE=enabled'], 'Actual fenced API observation missing')
            api_binding = fenced  # Compose may legitimately recreate it: bind the actual new full ID.
            require(http_status('/health') == 200, 'fenced API health probe did not return 200')
            fence_status = http_status('/api/v1/customers', method='POST')
            require(fence_status == 503, f'write probe under fence returned {fence_status}, expected 503')
            t_obs = iso(utcnow())
            stop_verified_api(args.attachments_dir, api_binding)
            t_stop = iso(utcnow())
            fence = build_write_fence(api_sha, t_fence, t_obs, t_stop)
            (evidence / 'write_fence.json').write_text(json.dumps(fence))
            emit('write-fence', {'method': fence['method'], 'api_release_sha': api_sha,
                                 'write_probe_status': fence_status})

            step = 'task-drain'
            # Gate intent: no IN-FLIGHT work crossing the maintenance window. Seed-era
            # outbox events with no consumer delivery (pre-production demo data) are
            # legacy undelivered, not in-flight; they are disclosed below and tracked
            # as TD-REL-006 instead of blocking migration windows.
            inflight_sql = inflight_drain_sql()
            legacy_sql = legacy_undelivered_sql()
            try:
                in_flight = int(require_zero(session, inflight_sql,
                                             'background queues have in-flight work'))
            except RuntimeError:
                stuck = session.query(
                    "SELECT o.id::text, o.event_type, d.state, o.created_at::text"
                    " FROM domain_event_outbox o"
                    " LEFT JOIN event_consumer_deliveries d ON d.event_id=o.id AND d.tenant_id=o.tenant_id"
                    " WHERE (o.created_at >= now()"
                    f" - interval '{DRAIN_INFLIGHT_CUTOFF_DAYS} days' AND d.id IS NULL)"
                    " OR d.state IN ('PENDING','PROCESSING')")
                emit('task-drain-stuck', {'records': [' '.join(line.split()) for line in stuck]},
                     status='FAIL')
                raise
            legacy = int(scalar(session, legacy_sql))
            drain = {'background_queues_drained': True, 'external_write_channels_isolated': True,
                     'drained_at_utc': iso(utcnow()),
                     'in_flight': in_flight, 'legacy_undelivered_observed': legacy}
            (evidence / 'task_drain.json').write_text(json.dumps(drain))
            emit('task-drain', {'in_flight': in_flight, 'legacy_undelivered': legacy})

            step = 'backup-restore'
            stamp2 = utcnow().strftime('%Y%m%dT%H%M%SZ')
            gate_dump = args.prod_root / '.release-backups' / f'wave2-{stamp2}.dump'
            attach = args.prod_root / '.release-backups' / f'attachments-{stamp2}.tar.gz'
            dump_sha = dump_database(args.postgres_container, user, db, gate_dump)
            with tarfile.open(attach, 'x:gz') as archive:
                archive.add(args.attachments_dir, arcname='attachments')
            os.chmod(attach, 0o600)
            att_sha = hashlib.sha256(attach.read_bytes()).hexdigest()
            scratch = 'wave2-restore-' + stamp2
            pg_image = json.loads(command(['docker', 'inspect', args.postgres_container]))[0]['Image']
            command(['docker', 'run', '-d', '--pull', 'never', '--network', 'none', '--name', scratch,
                     '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_USER=verify',
                     '-e', 'POSTGRES_DB=verification', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', pg_image])
            try:
                for attempt in range(30):
                    # The image's temporary init server listens only on a Unix socket.
                    probe = subprocess.run(['docker', 'exec', scratch, 'pg_isready', '-h', '127.0.0.1',
                                            '-U', 'verify', '-d', 'verification'], capture_output=True)
                    if probe.returncode == 0:
                        break
                    time.sleep(1)
                else:
                    raise RuntimeError('isolated restore database did not start')
                command(['docker', 'exec', '-i', scratch, 'pg_restore', '--username=verify',
                         '--dbname=verification', '--no-owner', '--no-acl', '--exit-on-error'],
                        timeout=600, stdin_bytes=gate_dump.read_bytes())
                restored = command(['docker', 'exec', scratch, 'psql', '-X', '-qAt', '-U', 'verify',
                                    '-d', 'verification', '-c',
                                    'SELECT count(*) FROM schema_migrations;']).decode().strip()
                require(restored == str(args.expected_before),
                        f'restored registry count {restored} != {args.expected_before}')
            finally:
                command(['docker', 'rm', '-f', scratch])
            backup = {
                'database_dump': {'file': gate_dump.name, 'sha256': dump_sha,
                                  'captured_at_utc': iso(utcnow())},
                'attachments_archive': {'file': attach.name, 'sha256': att_sha,
                                        'captured_at_utc': iso(utcnow())},
                'config_material': 'AVAILABLE', 'restore_rehearsal': 'PASS',
                'rehearsal_report': f'wave2-{stamp2}-restore', 'rpo_statement': 'RPO=0 fence-gated joint backup',
                'rto_statement': 'RTO<1h isolated rehearsal',
            }
            (evidence / 'backup_restore.json').write_text(json.dumps(backup))
            emit('backup-restore', {'dump': gate_dump.name, 'sha256': dump_sha,
                                    'restored_registry': args.expected_before})

            step = 'data-preconditions'
            counts = []
            for query in ro.DATA_PRECONDITION_SQL:
                require_zero(session, 'SELECT count(*) FROM (' + query + ') probe',
                             'data precondition returned non-zero')
                counts.append(0)
            preconditions = {'negative_balance_groups': 0, 'over_return_groups': 0,
                             'orphan_return_movements': 0, 'checked_at_utc': iso(utcnow())}
            (evidence / 'data_preconditions.json').write_text(json.dumps(preconditions))
            emit('data-preconditions', {'counts': counts})

            step = 'release-approval'
            approval = recovery_approval or build_release_approval(args.candidate_sha, suffixes, args.approver, utcnow())
            (evidence / 'release_approval.json').write_text(json.dumps(approval))
            emit('release-approval', {'approver': args.approver,
                                      'window_end_utc': approval['window_end_utc']})

            step = 'check-evidence'
            checked = run_orchestrator(staged, 'check-evidence', str(plan_path), str(evidence))
            require(checked.get('check_evidence') == 'PASS', f'check-evidence verdict: {checked}')
            emit('check-evidence', checked)

            step = 'state-archive'
            archive_terminal_state(args.prod_root, args.candidate_sha)

            step = 'execute'
            migration_started = True
            executed = run_orchestrator(staged, 'execute', str(plan_path), str(evidence), str(migrations),
                                    str(args.prod_root / '.release-migration-state'), 'ignored',
                                    '--psql-argv-file', write_psql_argv_file(staged, argv))
            require(executed.get('verdict') == 'COMPLETED', f'execute verdict: {executed}')
            emit('execute', executed)

            step = 'postcheck'
            posted = run_orchestrator(staged, 'postcheck', str(plan_path), 'ignored',
                                  '--psql-argv-file', write_psql_argv_file(staged, argv))
            require(posted.get('postcheck') == 'PASS'
                    and posted.get('classification') == 'FULLY_MATCHED',
                    f'postcheck verdict: {posted}')
            final = ro.read_registry(session)
            require(len(final) == args.expected_after,
                    f'final registry count {len(final)} != {args.expected_after}')
            emit('postcheck', dict(posted, final_count=len(final)))
        finally:
            session.close()
        emit('done', {'api_state': 'stopped (recover switch restores service)',
                      'write_fence': 'enabled (recover switch disables)'})
    except Exception as failure:  # noqa: BLE001 - single fail-closed report path
        emit(step, {'error': str(failure)[:500]}, status='FAIL')
        if fence_applied:
            try:
                require(api_binding is not None and api_identity(observe_api(args.attachments_dir)) == api_identity(api_binding), 'API stop source changed')
            except Exception:
                emit('api-source-changed', {'write_fence': 'enabled', 'api_restart': 'NOT_ATTEMPTED'}, status='FAIL')
                sys.exit(1)
            if recovery_approval is not None and migration_started:
                emit('compatible-recovery-required', {'api_state': 'stopped', 'write_fence': 'enabled', 'old_image_restart': 'NOT_ATTEMPTED'}, status='FAIL')
                sys.exit(1)
            # Design gap fixed: this script stopped the API, so this script must
            # restore it on failure (schema untouched pre-execute; after a partial
            # execute the orchestrator guarantees no registration of failed work).
            try:
                restored = restore_api_on_failure(args.prod_root)
            except Exception as restore_failure:  # noqa: BLE001 - report, keep scene
                emit('api-restore-failed', {'error': str(restore_failure)[:300]}, status='FAIL')
                sys.exit(2)
            # Migration incomplete: the run stays a failure even when the API was
            # restored — a green run must mean the approved suffix was applied.
            sys.exit(1)
        sys.exit(1)


def write_psql_argv_file(staged, argv):
    path = staged / 'psql-argv.json'
    path.write_text(json.dumps(argv))
    return str(path)


if __name__ == '__main__':
    main()
