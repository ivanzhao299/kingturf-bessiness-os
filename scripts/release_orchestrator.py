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


class StopError(RuntimeError):
    """Raised for any fail-closed stop; the caller records state and exits non-zero."""


def utcnow():
    return datetime.now(timezone.utc)


def parse_instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None, 'timestamps must carry an explicit UTC offset')
    return parsed


def migration_checksum(path):
    """Byte-for-byte the repository migrator's digest: sha256 over utf8 file text."""
    return hashlib.sha256(path.read_text(encoding='utf8').encode('utf8')).hexdigest()


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
    except (ValueError, RuntimeError) as error:
        raise StopError(f'GATE_FAILED:{name}: evidence unreadable ({error})') from error


def check_approval(evidence, plan, now):
    require(evidence.get('release_sha') == plan['release_sha'], 'GATE_FAILED:release_approval: approved SHA differs from plan')
    approved = evidence.get('approved_suffix')
    require(isinstance(approved, list) and sorted(approved) == sorted(p['name'] for p in plan['pending']), 'GATE_FAILED:release_approval: approved suffix does not match planned pending migrations')
    require(bool(evidence.get('approver')), 'GATE_FAILED:release_approval: approver missing')
    window_start = parse_instant(require_value(evidence, 'approved_at_utc', 'release_approval'))
    window_end = parse_instant(require_value(evidence, 'window_end_utc', 'release_approval'))
    require(window_start <= now < window_end, 'GATE_FAILED:release_approval: maintenance window not active')
    return hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()


def require_value(evidence, key, gate_name):
    value = evidence.get(key)
    require(isinstance(value, str) and value.strip(), f'GATE_FAILED:{gate_name}: field {key} missing')
    return value


def check_write_fence(evidence, now):
    require(evidence.get('method') == 'api_write_fence', 'GATE_FAILED:write_fence: unsupported fence method')
    require(evidence.get('in_flight_settled') is True, 'GATE_FAILED:write_fence: in-flight requests not settled')
    require_value(evidence, 'enabled_at_utc', 'write_fence')
    require_value(evidence, 'observed_no_new_writes_utc', 'write_fence')
    require_value(evidence, 'api_release_sha', 'write_fence')
    observed = parse_instant(evidence['observed_no_new_writes_utc'])
    require(observed <= now, 'GATE_FAILED:write_fence: observation timestamp is in the future')


def check_task_drain(evidence):
    require(evidence.get('background_queues_drained') is True, 'GATE_FAILED:task_drain: background queues not drained')
    require(evidence.get('external_write_channels_isolated') is True, 'GATE_FAILED:task_drain: external write channels not isolated')
    require_value(evidence, 'drained_at_utc', 'task_drain')


def check_backup_restore(evidence):
    dump = evidence.get('database_dump')
    require(isinstance(dump, dict) and dump.get('file') and dump.get('sha256'), 'GATE_FAILED:backup_restore: database dump evidence incomplete')
    attachments = evidence.get('attachments_archive')
    require(isinstance(attachments, dict) and attachments.get('file') and attachments.get('sha256'), 'GATE_FAILED:backup_restore: attachments archive evidence incomplete')
    require(evidence.get('config_material') == 'AVAILABLE', 'GATE_FAILED:backup_restore: config/secret recovery material missing')
    require(evidence.get('restore_rehearsal') == 'PASS', 'GATE_FAILED:backup_restore: joint restore rehearsal not passed')
    require(bool(evidence.get('rehearsal_report')), 'GATE_FAILED:backup_restore: rehearsal report reference missing')
    require(bool(evidence.get('rpo_statement')) and bool(evidence.get('rto_statement')), 'GATE_FAILED:backup_restore: RPO/RTO statements missing')


def check_image_compatibility(evidence):
    digest = require_value(evidence, 'candidate_image_digest', 'image_compatibility')
    require(len(digest) >= 64 and all(c in '0123456789abcdef' for c in digest), 'GATE_FAILED:image_compatibility: digest malformed')
    old_app = evidence.get('old_app_on_new_schema')
    require(isinstance(old_app, dict) and old_app.get('verified') is True and old_app.get('evidence'), 'GATE_FAILED:image_compatibility: old-application-on-new-schema not verified')


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


def write_state(state_dir, state):
    Path(state_dir).mkdir(parents=True, exist_ok=True)
    (Path(state_dir) / 'orchestration-state.json').write_text(json.dumps(state, indent=2) + '\n')


def run_stages(plan, evidence_dir, session, migrations_dir, state_dir, now=None, *, new_approval=None):
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
    for name, check in GATES:
        try:
            evidence = load_evidence(evidence_dir, name)
            if name == 'release_approval':
                approval_sha = check(evidence, plan, now)
            elif name == 'write_fence':
                check(evidence, now)
            else:
                check(evidence)
        except (StopError, RuntimeError) as error:
            stop(name, str(error))
        record(name, 'evidence accepted')
    state['approval_sha256'] = approval_sha
    try:
        fence_evidence = load_evidence(evidence_dir, 'write_fence')
        check_data_preconditions(load_evidence(evidence_dir, 'data_preconditions'), fence_evidence)
    except (StopError, RuntimeError) as error:
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
        base = Path(migrations_dir)
        for item in pending:
            path = base / item['name']
            require(path.is_file(), f'approved migration file missing: {item["name"]}')
            require(migration_checksum(path) == item['checksum'], f'approved migration file drifted: {item["name"]}')
            sql = path.read_text(encoding='utf8')
            # name/checksum are strictly regex-validated constants from the plan manifest.
            wrapped = ("BEGIN;\nSET LOCAL lock_timeout = '2s';\nSET LOCAL statement_timeout = '60s';\n"
                       "SET LOCAL idle_in_transaction_session_timeout = '60s';\n"
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
    except RuntimeError as error:
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
                    new_approval = hashlib.sha256(Path(rest[1]).read_bytes()).hexdigest()
                elif rest[0] == '--psql-argv-file' and len(rest) >= 2:
                    target = json.loads(Path(rest[1]).read_text())
                else:
                    raise RuntimeError('unknown execute argument: ' + rest[0])
                rest = rest[2:]
            session = PsqlSession(target)
            try:
                state = run_stages(plan, args[2], session, args[3], args[4], new_approval=new_approval)
                print(json.dumps({'verdict': state['verdict']}))
            finally:
                session.close()
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
                               'postcheck <plan.json> <database-url> [--psql-argv-file file]')
    except StopError as error:
        print('orchestration STOPPED: ' + str(error), file=sys.stderr)
        sys.exit(2)
    except RuntimeError as error:
        print('orchestration refused: ' + str(error), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
