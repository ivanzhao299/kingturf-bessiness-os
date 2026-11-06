#!/usr/bin/env python3
"""Controlled KingTurf migration orchestration: fail-closed, single-flight, evidence-gated.

Implements the approved release sequence around migration execution only. It never
retries automatically, never repairs history, and requires explicit evidence
artifacts (write fence, task drain, joint backup/restore, image compatibility,
data preconditions) plus a still-valid release approval before applying the exact
approved pending suffix. Production execution additionally requires its own
authorization; this module is verified in isolation.
"""
import hashlib
import importlib.util
import json
import re
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('production_preflight', HERE / 'production_preflight.py')
gate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gate)
require, classify_registry = gate.require, gate.classify_registry

REGISTRY_SQL = "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'checksum',checksum) ORDER BY name),'[]'::jsonb) FROM schema_migrations; COMMIT;"
ADVISORY_KEY = "kingturf-release-migration"
DATA_PRECONDITION_SQL = (
    "SELECT 1 FROM inventory_movements GROUP BY tenant_id,item_version_id,lot_id,location_id HAVING sum(quantity_delta)<0",
    "SELECT 1 FROM production_material_transactions GROUP BY tenant_id,production_order_id,item_version_id,lot_id,location_id HAVING coalesce(sum(quantity) FILTER (WHERE transaction_type='RETURN'),0) > coalesce(sum(quantity) FILTER (WHERE transaction_type='ISSUE'),0)",
    "SELECT 1 FROM inventory_movements m WHERE m.source_type='PRODUCTION_ORDER' AND m.movement_type='RETURN' AND NOT EXISTS (SELECT 1 FROM production_material_transactions t WHERE t.tenant_id=m.tenant_id AND t.inventory_movement_id=m.id AND t.transaction_type='RETURN')",
)


class StopError(RuntimeError):
    """Raised for any fail-closed stop; the caller records state and exits non-zero."""


def utcnow():
    return datetime.now(timezone.utc)


MAX_WINDOW = 12 * 3600


def parse_instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0, 'timestamps must be UTC (Z or +00:00)')
    return parsed


def migration_checksum(path):
    """Byte-for-byte the repository migrator's digest (sha256 over raw file bytes)."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_manifest(directory):
    base = Path(directory)
    files = sorted(base.glob('[0-9][0-9][0-9][0-9]*.sql'))
    require(bool(files), 'No candidate migration files found')
    return {p.name: migration_checksum(p) for p in files}


class PsqlSession:
    """One long-lived psql process so the advisory lock spans the whole run.

    Accepts either a database URL or an explicit argv (for example a
    `docker compose ... exec -T postgres psql ...` prefix) so the same session
    semantics work on a production host without a published database port.
    """

    def __init__(self, target):
        if isinstance(target, list):
            argv = target
            # The no-registration-on-failure guarantee depends on this flag;
            # never trust a caller-supplied argv that omits it. The flag may sit in a
            # single sh -c command string (the production compose-exec form) or as a
            # standalone -v ON_ERROR_STOP=1 element.
            require(any('ON_ERROR_STOP=1' in part for part in argv), 'psql argv must include -v ON_ERROR_STOP=1')
        else:
            argv = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', target]
        self.process = subprocess.Popen(
            argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def _read_until(self, marker):
        lines = []
        while True:
            line = self.process.stdout.readline()
            if not line:
                error = self.process.stderr.read()
                raise StopError('database session ended unexpectedly: ' + error.strip()[:200])
            if line.rstrip('\n') == marker:
                return lines
            lines.append(line.rstrip('\n'))

    def query(self, sql):
        # A statement without a terminating semicolon would silently swallow the
        # next statement; enforce termination before the marker protocol runs.
        terminated = sql.rstrip()
        if not terminated.endswith(';'):
            terminated += ';'
        marker = '<<<KINGTURF-ORCH-MARKER>>>'
        self.process.stdin.write(terminated + '\n\\echo ' + marker + '\n')
        self.process.stdin.flush()
        return self._read_until(marker)

    def close(self):
        try:
            self.process.stdin.close()
            self.process.wait(timeout=10)
        except Exception:
            self.process.kill()
        finally:
            self.process.stdout.close()
            self.process.stderr.close()


def read_registry(session):
    output = session.query(REGISTRY_SQL)
    rows = json.loads(''.join(output))
    require(isinstance(rows, list), 'registry query did not return a list')
    return rows


def load_evidence(evidence_dir, name, *, required=True):
    path = Path(evidence_dir) / (name + '.json')
    if not path.is_file():
        if required:
            raise StopError(f'GATE_FAILED:{name}: evidence file missing: {name}.json')
        return None
    try:
        value = json.loads(path.read_text())
        require(isinstance(value, dict), 'evidence must be a JSON object')
        return value
    except (ValueError, RuntimeError, OSError) as error:
        raise StopError(f'GATE_FAILED:{name}: evidence unreadable ({error})') from error


def check_approval(evidence, plan, now):
    require(evidence.get('release_sha') == plan['release_sha'], 'GATE_FAILED:release_approval: approved SHA differs from plan')
    approved = evidence.get('approved_suffix')
    require(isinstance(approved, list) and sorted(approved) == sorted(p['name'] for p in plan['pending']), 'GATE_FAILED:release_approval: approved suffix does not match planned pending migrations')
    require(bool(evidence.get('approver')), 'GATE_FAILED:release_approval: approver missing')
    window_start = parse_instant(require_value(evidence, 'approved_at_utc', 'release_approval'))
    window_end = parse_instant(require_value(evidence, 'window_end_utc', 'release_approval'))
    require(window_start <= now < window_end, 'GATE_FAILED:release_approval: maintenance window not active')
    require(0 < (window_end - window_start).total_seconds() <= MAX_WINDOW, f'GATE_FAILED:release_approval: window duration must be within 12 hours')
    return hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()


def require_value(evidence, key, gate_name):
    value = evidence.get(key)
    require(isinstance(value, str) and value.strip(), f'GATE_FAILED:{gate_name}: field {key} missing')
    return value


FENCE_METHODS = ('api_write_fence', 'controlled_old_api_shutdown')

EVIDENCE_DIR_NAME = '.release-migration-evidence'

# The deploy root is the PARENT of the evidence directory when the evidence
# directory keeps its canonical name (release/.release-migration-evidence).
DIGEST_PATTERN = re.compile(r'(?:sha256:)?[0-9a-f]{64}')


def derive_release_root(evidence_root):
    root = Path(evidence_root)
    return root.parent if root.name == EVIDENCE_DIR_NAME else root


def normalize_digest(digest):
    """Accept the compose/env form `sha256:<64hex>` and bare `<64hex>`; return bare hex."""
    value = digest[7:] if digest.startswith('sha256:') else digest
    return value if DIGEST_PATTERN.fullmatch(value) else None



def check_write_fence(evidence, now):
    require(evidence.get('method') in FENCE_METHODS, 'GATE_FAILED:write_fence: unsupported fence method')
    require(evidence.get('in_flight_settled') is True, 'GATE_FAILED:write_fence: in-flight requests not settled')
    require_value(evidence, 'enabled_at_utc', 'write_fence')
    require_value(evidence, 'observed_no_new_writes_utc', 'write_fence')
    require_value(evidence, 'api_release_sha', 'write_fence')
    if evidence.get('method') == 'controlled_old_api_shutdown':
        require(evidence.get('api_service_state') == 'stopped', 'GATE_FAILED:write_fence: controlled shutdown requires api_service_state=stopped')
        require_value(evidence, 'stopped_at_utc', 'write_fence')
    observed = parse_instant(evidence['observed_no_new_writes_utc'])
    require(observed <= now, 'GATE_FAILED:write_fence: observation timestamp is in the future')


def check_task_drain(evidence):
    require(evidence.get('background_queues_drained') is True, 'GATE_FAILED:task_drain: background queues not drained')
    require(evidence.get('external_write_channels_isolated') is True, 'GATE_FAILED:task_drain: external write channels not isolated')
    require_value(evidence, 'drained_at_utc', 'task_drain')


def check_backup_restore(evidence, fence_evidence, backup_root=None):
    fenced = parse_instant(require_value(fence_evidence, 'enabled_at_utc', 'write_fence'))

    def artifact(kind, label):
        value = evidence.get(kind)
        require(isinstance(value, dict), f'GATE_FAILED:backup_restore: {label} evidence incomplete')
        require(isinstance(value.get('file'), str) and value['file'].strip(), f'GATE_FAILED:backup_restore: {label} file missing')
        sha = value.get('sha256')
        require(isinstance(sha, str) and len(sha) == 64 and all(c in '0123456789abcdef' for c in sha), f'GATE_FAILED:backup_restore: {label} sha256 malformed')
        captured = parse_instant(require_value(value, 'captured_at_utc', 'backup_restore'))
        require(captured >= fenced, f'GATE_FAILED:backup_restore: {label} captured before the write fence')

    def verified_artifact(kind, label):
        artifact(kind, label)
        value = evidence[kind]
        path = Path(value['file'])
        require(not path.is_absolute(), f'GATE_FAILED:backup_restore: {label} file must be relative to .release-backups')
        root = Path(backup_root or '.').resolve()
        resolved = (root / path).resolve()
        require(resolved == root or root in resolved.parents, f'GATE_FAILED:backup_restore: {label} file escapes .release-backups')
        require(resolved.is_file(), f'GATE_FAILED:backup_restore: {label} file not found at {resolved}')
        actual = hashlib.sha256(resolved.read_bytes()).hexdigest()
        require(actual == value['sha256'], f'GATE_FAILED:backup_restore: {label} sha256 mismatch (evidence vs actual file)')

    verified_artifact('database_dump', 'database dump')
    verified_artifact('attachments_archive', 'attachments archive')
    require(evidence.get('config_material') == 'AVAILABLE', 'GATE_FAILED:backup_restore: config/secret recovery material missing')
    require(evidence.get('restore_rehearsal') == 'PASS', 'GATE_FAILED:backup_restore: joint restore rehearsal not passed')
    require(bool(evidence.get('rehearsal_report')), 'GATE_FAILED:backup_restore: rehearsal report reference missing')
    require(bool(evidence.get('rpo_statement')) and bool(evidence.get('rto_statement')), 'GATE_FAILED:backup_restore: RPO/RTO statements missing')


def check_image_compatibility(evidence):
    for key in ('api_digest', 'web_digest'):
        digest = require_value(evidence, key, 'image_compatibility')
        require(normalize_digest(digest) is not None, f'GATE_FAILED:image_compatibility: {key} malformed')
    old_app = evidence.get('old_app_on_new_schema')
    require(isinstance(old_app, dict) and old_app.get('verified') is True and isinstance(old_app.get('evidence'), str) and old_app['evidence'].strip(), 'GATE_FAILED:image_compatibility: old-application-on-new-schema not verified')


def check_data_preconditions(evidence, fence_evidence):
    for key in ('negative_balance_groups', 'over_return_groups', 'orphan_return_movements'):
        require(evidence.get(key) == 0, f'GATE_FAILED:data_preconditions: {key} is not zero')
    checked = parse_instant(require_value(evidence, 'checked_at_utc', 'data_preconditions'))
    fenced = parse_instant(require_value(fence_evidence, 'enabled_at_utc', 'write_fence'))
    require(checked >= fenced, 'GATE_FAILED:data_preconditions: checks predate the write fence')


GATES = (
    ('release_approval', check_approval),
    ('write_fence', check_write_fence),
    ('task_drain', check_task_drain),
    ('backup_restore', check_backup_restore),
    ('image_compatibility', check_image_compatibility),
)


def build_plan(migrations_dir, release_sha, registry_rows):
    manifest = read_manifest(migrations_dir)
    classification, pending = classify_registry(registry_rows, manifest)
    return {
        'release_sha': release_sha,
        'classification': classification,
        'pending': pending,
        'manifest': manifest,
        'created_at_utc': utcnow().isoformat(),
    }


def plan_sha256(plan):
    return hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()


def load_state(state_dir, release_sha):
    path = Path(state_dir) / 'orchestration-state.json'
    if not path.is_file():
        return None
    state = json.loads(path.read_text())
    require(state.get('release_sha') == release_sha, 'state directory belongs to a different release')
    return state


def load_new_approval(path, release_sha):
    """Canonicalize a fresh approval artifact so rerun comparisons are like-for-like."""
    candidate = json.loads(Path(path).read_text())
    require(isinstance(candidate, dict), 'new approval artifact is not a JSON object')
    require(candidate.get('release_sha') == release_sha, 'new approval artifact belongs to a different release')
    return hashlib.sha256(json.dumps(candidate, sort_keys=True).encode()).hexdigest()


def write_state(state_dir, state):
    Path(state_dir).mkdir(parents=True, exist_ok=True)
    (Path(state_dir) / 'orchestration-state.json').write_text(json.dumps(state, indent=2) + '\n')


def run_stages(plan, evidence_dir, session, migrations_dir, state_dir, now=None, *, new_approval=None, backup_root=None, release_root=None):
    """Execute the gated sequence. Returns the terminal state; raises StopError on any stop."""
    now = now or utcnow()
    stages = []
    state = {'release_sha': plan['release_sha'], 'plan_sha256': plan_sha256(plan), 'stages': stages, 'verdict': 'RUNNING'}

    def record(name, detail):
        stages.append({'name': name, 'status': 'PASS', 'detail': detail, 'at_utc': utcnow().isoformat()})
        write_state(state_dir, state)

    def stop(stage, reason):
        state['verdict'] = 'STOPPED'
        state['stop_stage'] = stage
        state['stop_reason'] = reason
        try:
            state['registry_after_stop'] = read_registry(session)
        except Exception:
            state['registry_after_stop'] = 'UNAVAILABLE'
        write_state(state_dir, state)
        raise StopError(f'{stage}: {reason}')

    previous = load_state(state_dir, plan['release_sha'])
    if previous:
        if previous.get('verdict') == 'COMPLETED':
            raise StopError('execute: plan already COMPLETED; a new release needs a new plan')
        if previous.get('verdict') == 'STOPPED':
            require(new_approval is not None, 'execute: previous attempt STOPPED; refusing to rerun without --new-approval evidence')
            require(new_approval != previous.get('approval_sha256'), 'execute: --new-approval must be a fresh approval artifact, not the consumed one')
    record('verify_plan', f"pending={len(plan['pending'])}")

    approval_sha = None
    fence_evidence = None
    for name, check in GATES:
        try:
            evidence = load_evidence(evidence_dir, name)
            if name == 'release_approval':
                approval_sha = check(evidence, plan, now)
            elif name == 'write_fence':
                fence_evidence = evidence
                check(evidence, now)
            elif name == 'backup_restore':
                check(evidence, fence_evidence, backup_root)
            else:
                check(evidence)
        except (StopError, RuntimeError, ValueError, OSError) as error:
            stop(name, str(error))
        record(name, 'evidence accepted')
    state['approval_sha256'] = approval_sha
    try:
        check_data_preconditions(load_evidence(evidence_dir, 'data_preconditions'), fence_evidence)
    except (StopError, RuntimeError, ValueError, OSError) as error:
        stop('data_preconditions', str(error))
    record('data_preconditions', 'zero anomalies after fence')

    try:
        lock = session.query(f"SELECT pg_try_advisory_lock(hashtext('{ADVISORY_KEY}'))")
        require(lock == ['t'], 'CONCURRENT_MIGRATION_ACTIVE: another orchestrator holds the migration lock')
        record('advisory_lock', 'acquired')
        # Registry bootstrap mirrors the repository migrator exactly (idempotent).
        session.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
        session.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64)')
        session.query('ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL')
        rows = read_registry(session)
        classification, pending = classify_registry(rows, plan['manifest'])
        require(classification == plan['classification'] and [p['name'] for p in pending] == [p['name'] for p in plan['pending']], 'REGISTRY_CHANGED_UNDER_LOCK: live registry no longer matches the approved plan')

        # Cross-verify declared fence against REAL runtime state (no JSON-only trust).
        if fence_evidence.get('method') == 'controlled_old_api_shutdown':
            require(release_root is not None, 'FENCE_STATE_MISMATCH: controlled_old_api_shutdown requires the canonical .release-migration-evidence layout for live cross-verification')
            ps = subprocess.run(['docker', 'compose', '--env-file', str(Path(release_root) / '.env.production'),
                                 '-f', str(Path(release_root) / 'infra/docker/compose.production.yaml'),
                                 'ps', '--status', 'running', '--format', 'json', 'api'],
                                capture_output=True, text=True, timeout=30)
            require(ps.returncode == 0 and not ps.stdout.strip(), 'FENCE_STATE_MISMATCH: declared api stopped but docker compose reports a running api service')
            record('fence_cross_check', 'docker compose confirms api service stopped')
        backends = session.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend' AND state<>'idle'")
        require(backends == ['0'], f'FENCE_STATE_MISMATCH: {backends[0] if backends else "?"} active non-orchestrator client backend(s) on the target database')
        record('quiescence_probe', 'active non-orchestrator client backends = 0')

        # Re-run the three Phase 12B data preconditions LIVE under the lock; JSON claims are not trusted.
        # A zero-registry bootstrap (fresh database) has no tables yet and nothing historical to recheck.
        tables_present = session.query("SELECT to_regclass('inventory_movements') IS NOT NULL AND to_regclass('production_material_transactions') IS NOT NULL")
        if tables_present == ['t']:
            live_counts = []
            for query in DATA_PRECONDITION_SQL:
                live_counts.append(session.query('SELECT count(*) FROM (' + query + ') probe')[0])
            require(live_counts == ['0', '0', '0'], f'DATA_PRECONDITION_MISMATCH: live counts {live_counts} != 0/0/0')
            state['live_data_preconditions'] = [int(count) for count in live_counts]
            record('data_preconditions_live', 're-executed under lock: 0/0/0')
        else:
            require(len(rows) == 0, 'DATA_PRECONDITION_MISMATCH: business tables missing on a non-empty registry')
            record('data_preconditions_live', 'skipped: zero-registry bootstrap')
        base = Path(migrations_dir)
        for item in pending:
            path = base / item['name']
            require(path.is_file(), f'approved migration file missing: {item["name"]}')
            # Read once; hash and execute the SAME bytes so no swap between
            # verification and execution can ever run unverified content.
            data = path.read_bytes()
            require(hashlib.sha256(data).hexdigest() == item['checksum'], f'approved migration file drifted: {item["name"]}')
            sql = data.decode('utf8')
            # name/checksum come from the manifest whose charset excludes quotes/semicolons
            # (strict NAME_PATTERN/CHECKSUM_PATTERN in production_preflight).
            wrapped = ("BEGIN;\nSET LOCAL lock_timeout = '2s';\nSET LOCAL statement_timeout = '300s';\n"
                       "SET LOCAL idle_in_transaction_session_timeout = '300s';\n"
                       + sql.rstrip() + '\n'
                       + "INSERT INTO schema_migrations(name,checksum) VALUES ('" + item['name'] + "','" + item['checksum'] + "');\nCOMMIT;\n")
            try:
                session.query(wrapped)
            except StopError as error:
                stop('apply:' + item['name'], f'migration failed: {error}')
            verify = session.query(f"SELECT checksum FROM schema_migrations WHERE name = '{item['name']}';")
            require(verify == [item['checksum']], f'registration missing after applying {item["name"]}')
            record('apply:' + item['name'], 'applied and registered')
        rows = read_registry(session)
        classification, _ = classify_registry(rows, plan['manifest'])
        require(classification == 'FULLY_MATCHED', 'postcheck: registry is not FULLY_MATCHED after the approved suffix')
        record('postcheck', 'FULLY_MATCHED')
    except StopError:
        raise
    except (RuntimeError, ValueError, OSError) as error:
        stop('execute', str(error))
    finally:
        try:
            session.query(f"SELECT pg_advisory_unlock(hashtext('{ADVISORY_KEY}'))")
        except Exception:
            pass
    state['verdict'] = 'COMPLETED'
    write_state(state_dir, state)
    return state


def main():
    args = sys.argv[1:]
    try:
        if len(args) == 4 and args[0] == 'plan':
            registry = json.loads(Path(args[3]).read_text())
            print(json.dumps(build_plan(args[1], args[2], registry)))
        elif len(args) >= 6 and args[0] == 'execute':
            plan = json.loads(Path(args[1]).read_text())
            require(read_manifest(args[3]) == plan['manifest'], 'migration directory no longer matches the plan manifest')
            target, new_approval, rest = args[5], None, args[6:]
            while rest:
                if rest[0] == '--new-approval' and len(rest) >= 2:
                    # Hash the CANONICAL form of the new approval artifact so the
                    # comparison against the consumed approval hash is like-for-like.
                    new_approval = load_new_approval(rest[1], plan['release_sha'])
                elif rest[0] == '--psql-argv-file' and len(rest) >= 2:
                    target = json.loads(Path(rest[1]).read_text())
                else:
                    raise RuntimeError('unknown execute argument: ' + rest[0])
                rest = rest[2:]
            session = PsqlSession(target)
            evidence_root = Path(args[2])
            release_root = derive_release_root(evidence_root)
            try:
                state = run_stages(plan, args[2], session, args[3], args[4], new_approval=new_approval,
                                   backup_root=release_root / '.release-backups', release_root=release_root if release_root != evidence_root else None)
                print(json.dumps({'verdict': state['verdict']}))
            finally:
                session.close()
        elif len(args) == 3 and args[0] == 'check-evidence':
            plan = json.loads(Path(args[1]).read_text())
            evidence_root = Path(args[2])
            release_root = derive_release_root(evidence_root)
            now = utcnow()
            fence = load_evidence(evidence_root, 'write_fence')
            for name, check in GATES:
                ev = load_evidence(evidence_root, name)
                if name == 'release_approval':
                    check(ev, plan, now)
                elif name == 'write_fence':
                    check(ev, now)
                elif name == 'backup_restore':
                    check(ev, fence, release_root / '.release-backups')
                else:
                    check(ev)
            check_data_preconditions(load_evidence(evidence_root, 'data_preconditions'), fence)
            print(json.dumps({'check_evidence': 'PASS', 'pending': [p['name'] for p in plan['pending']]}))
        elif args and args[0] == 'registry' and len(args) in (2, 4):
            target = args[1]
            if len(args) == 4:
                require(args[2] == '--psql-argv-file', 'unknown registry argument')
                target = json.loads(Path(args[3]).read_text())
            session = PsqlSession(target)
            try:
                print(json.dumps(read_registry(session)))
            finally:
                session.close()
        elif args and args[0] == 'verify-images' and len(args) == 3:
            evidence = load_evidence(args[1], 'image_compatibility')
            env_path = Path(args[2])
            require(env_path.is_file(), f'IMAGE_DIGEST_MISMATCH: env file missing: {args[2]}')
            env = {}
            for line in env_path.read_text().splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    key, _, value = line.partition('=')
                    env[key.strip()] = value.strip()
            for var, key in (('KINGTURF_API_DIGEST', 'api_digest'), ('KINGTURF_WEB_DIGEST', 'web_digest')):
                # compose interpolates `${VAR}` after a literal `@`, so the env file MUST
                # carry the docker-native `sha256:<64hex>` form or every pull/config fails.
                env_digest = env.get(var)
                require(isinstance(env_digest, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', env_digest),
                        f'IMAGE_DIGEST_MISMATCH: {var} must be sha256:<64hex> in {args[2]}')
                evidence_digest = evidence.get(key)
                require(isinstance(evidence_digest, str) and normalize_digest(evidence_digest) is not None,
                        f'IMAGE_DIGEST_MISMATCH: evidence.{key} malformed')
                require(normalize_digest(env_digest) == normalize_digest(evidence_digest),
                        f'IMAGE_DIGEST_MISMATCH: {var} != evidence.{key}')
            print(json.dumps({'verify_images': 'PASS'}))
        elif args and args[0] == 'postcheck' and len(args) in (3, 5):
            plan = json.loads(Path(args[1]).read_text())
            target = args[2]
            if len(args) == 5:
                require(args[3] == '--psql-argv-file', 'unknown postcheck argument')
                target = json.loads(Path(args[4]).read_text())
            session = PsqlSession(target)
            try:
                classification, _ = classify_registry(read_registry(session), plan['manifest'])
                require(classification == 'FULLY_MATCHED', 'postcheck: registry is not FULLY_MATCHED')
                print(json.dumps({'postcheck': 'PASS', 'classification': 'FULLY_MATCHED'}))
            finally:
                session.close()
        else:
            raise RuntimeError('Usage: release_orchestrator.py plan <migrations> <release-sha> <registry.json> | '
                               'registry <database-url> [--psql-argv-file file] | '
                               'execute <plan.json> <evidence-dir> <migrations> <state-dir> <database-url|psql-argv via --psql-argv-file> [--new-approval file] | '
                               'check-evidence <plan.json> <evidence-dir> | '
                               'verify-images <evidence-dir> <env-file> | '
                               'postcheck <plan.json> <database-url> [--psql-argv-file file]')
    except StopError as error:
        print('orchestration STOPPED: ' + str(error), file=sys.stderr)
        sys.exit(2)
    except RuntimeError as error:
        print('orchestration refused: ' + str(error), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
