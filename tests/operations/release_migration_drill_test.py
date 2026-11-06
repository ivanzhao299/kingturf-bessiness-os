"""Real-PostgreSQL drill: controlled 70->72 upgrade, failure matrix, executor equivalence.

Runs the repository's actual migration files through the release orchestrator's real
psql session path against disposable scratch databases. Skips (explicitly, as
INCOMPLETE) when neither a psql client nor the local development container exists.
"""
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_orchestrator', ROOT / 'scripts/release_orchestrator.py')
ro = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ro)
MIGRATIONS = ROOT / 'packages/database/migrations'
REAL_FILES = sorted(MIGRATIONS.glob('[0-9][0-9][0-9][0-9]*.sql'))
assert len(REAL_FILES) == 72, 'candidate migration set must have exactly 72 files'

CONTAINER = 'kingturf-business-os-postgres-1'
PG_USER = 'kingturf'
ENV_URL = os.environ.get('DATABASE_URL')
URL_PREFIX = re.sub(r'/[^/?]*(\?[^/]*)?$', '/', ENV_URL) if ENV_URL else 'postgresql://kingturf:local-development-only@localhost:5432/'
HAS_PSQL = bool(shutil.which('psql'))
HAS_DOCKER = shutil.which('docker') is not None and subprocess.run(
    ['docker', 'inspect', CONTAINER], capture_output=True).returncode == 0 if shutil.which('docker') else False
RELEASE_SHA = '8' * 40
# Written into the per-run temp directory so the repository gains no .mjs artifact.
REFERENCE_MIGRATOR = (
    "import { Database, migrate } from 'file://" + str(ROOT / 'packages/database/src/index.ts') + "';\n"
    'const database = new Database(process.env.DATABASE_URL);\n'
    'await migrate(database, process.argv[2]);\n'
    "const result = await database.query('SELECT name,checksum FROM schema_migrations ORDER BY name');\n"
    "process.stdout.write(JSON.stringify(result.rows.map((row) => ({ name: row.name, checksum: row.checksum }))));\n"
    'await database.close();\n'
)


def session_for(database):
    if HAS_PSQL:
        return ro.PsqlSession(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', URL_PREFIX + database])
    return ro.PsqlSession(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', '-U', PG_USER, '-d', database])


def admin_session():
    if HAS_PSQL:
        return ro.PsqlSession(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', ENV_URL or URL_PREFIX + 'kingturf_dev'])
    return ro.PsqlSession(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', '-U', PG_USER, '-d', 'postgres'])


def write_evidence(directory, *, pending, preconditions_zero=True):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    from datetime import datetime, timedelta, timezone
    import hashlib as _h
    start = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
    end = (datetime.now(timezone.utc) + timedelta(hours=6)).strftime('%Y-%m-%dT%H:%M:%SZ')
    mid = (datetime.now(timezone.utc) - timedelta(minutes=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    late = (datetime.now(timezone.utc) - timedelta(minutes=29)).strftime('%Y-%m-%dT%H:%M:%SZ')
    backups = directory / '.release-backups'
    backups.mkdir(parents=True, exist_ok=True)
    (backups / 'x.dump').write_bytes(b'drill-dump')
    (backups / 'x.tar').write_bytes(b'drill-tar')
    values = {
        'release_approval': {'release_sha': RELEASE_SHA, 'approved_suffix': pending, 'approved_at_utc': start, 'window_end_utc': end, 'approver': 'drill'},
        'write_fence': {'method': 'api_write_fence', 'enabled_at_utc': start, 'observed_no_new_writes_utc': mid, 'api_release_sha': RELEASE_SHA, 'in_flight_settled': True},
        'task_drain': {'background_queues_drained': True, 'external_write_channels_isolated': True, 'drained_at_utc': mid},
        'backup_restore': {'database_dump': {'file': 'x.dump', 'sha256': _h.sha256(b'drill-dump').hexdigest(), 'captured_at_utc': late}, 'attachments_archive': {'file': 'x.tar', 'sha256': _h.sha256(b'drill-tar').hexdigest(), 'captured_at_utc': late}, 'config_material': 'AVAILABLE', 'restore_rehearsal': 'PASS', 'rehearsal_report': 'r.md', 'rpo_statement': 'rpo', 'rto_statement': 'rto'},
        'image_compatibility': {'api_digest': 'c' * 64, 'web_digest': 'd' * 64, 'old_app_on_new_schema': {'verified': True, 'evidence': 'e.md'}},
        'data_preconditions': {'negative_balance_groups': 0 if preconditions_zero else 1, 'over_return_groups': 0, 'orphan_return_movements': 0, 'checked_at_utc': late},
    }
    for name, value in values.items():
        (directory / (name + '.json')).write_text(json.dumps(value))


class Drill(unittest.TestCase):
    """Each test seeds scratch databases from a shared 70-migration template."""

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='kingturf-drill-')
        cls.base = Path(cls.temp.name)
        cls.filtered = cls.base / 'migrations70'
        cls.filtered.mkdir()
        for path in REAL_FILES[:70]:
            shutil.copy(path, cls.filtered / path.name)
        cls.template = 'phase12c_drill_template70'
        admin = admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {cls.template}')
            admin.query(f'CREATE DATABASE {cls.template}')
        finally:
            admin.close()
        session = session_for(cls.template)
        try:
            plan = ro.build_plan(cls.filtered, RELEASE_SHA, [])
            write_evidence(cls.base / 'evidence70', pending=[p['name'] for p in plan['pending']])
            ro.run_stages(plan, cls.base / 'evidence70', session, cls.filtered, cls.base / 'state70', backup_root=cls.base / 'evidence70' / '.release-backups')
        finally:
            session.close()

    @classmethod
    def tearDownClass(cls):
        admin = admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {cls.template}')
        finally:
            admin.close()
        cls.temp.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kingturf-drill-case-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.dbname = None
        self.sessions = []

    def teardown_db(self):
        for session in self.sessions:
            session.close()
        self.sessions = []
        if self.dbname:
            admin = admin_session()
            try:
                admin.query(f'DROP DATABASE IF EXISTS {self.dbname}')
            finally:
                admin.close()

    def make_db(self, name):
        self.addCleanup(self.teardown_db)
        self.dbname = name
        admin = admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {name}')
            admin.query(f'CREATE DATABASE {name} TEMPLATE {self.template}')
        finally:
            admin.close()
        session = session_for(name)
        self.sessions.append(session)
        return session

    def run_execute(self, session, migrations=MIGRATIONS, evidence=None, *, state_name='state'):
        plan = ro.build_plan(migrations, RELEASE_SHA, ro.read_registry(session))
        evidence = evidence or (self.base / 'evidence')
        write_evidence(evidence, pending=[p['name'] for p in plan['pending']])
        return ro.run_stages(plan, evidence, session, migrations, self.base / state_name, backup_root=evidence / '.release-backups')

    def registry_names(self, session):
        return [row['name'] for row in ro.read_registry(session)]

    def verify_registry(self):
        # A failed migration kills the executor session by design; verify on a fresh one.
        session = session_for(self.dbname)
        self.sessions.append(session)
        return self.registry_names(session)


@unittest.skipUnless(HAS_PSQL or HAS_DOCKER, 'no psql client and no local development postgres container')
class ControlledUpgradeDrill(Drill):
    def test_70_to_72_via_orchestrator_matches_reference_migrator_exactly(self):
        session = self.make_db('phase12c_drill_upgrade')
        state = self.run_execute(session)
        self.assertEqual(state['verdict'], 'COMPLETED')
        self.assertEqual(len(self.registry_names(session)), 72)
        admin = admin_session()
        try:
            admin.query('DROP DATABASE IF EXISTS phase12c_drill_reference')
            admin.query('CREATE DATABASE phase12c_drill_reference')
        finally:
            admin.close()
        try:
            runner = self.base / 'reference-migrator.mjs'
            runner.write_text(REFERENCE_MIGRATOR)
            migrated = subprocess.run(
                ['node', '--experimental-strip-types', str(runner), str(MIGRATIONS)],
                env={**os.environ, 'DATABASE_URL': URL_PREFIX + 'phase12c_drill_reference'},
                capture_output=True, text=True, timeout=600, check=True)
            reference = json.loads(migrated.stdout)
        finally:
            admin = admin_session()
            admin.query('DROP DATABASE IF EXISTS phase12c_drill_reference')
            admin.close()
        self.assertEqual([{'name': row['name'], 'checksum': row['checksum']} for row in ro.read_registry(session)], reference)

    def test_classification_matrix_on_real_registries(self):
        session = self.make_db('phase12c_drill_classify')
        manifest = ro.read_manifest(MIGRATIONS)
        rows = ro.read_registry(session)
        self.assertEqual(ro.classify_registry(rows, manifest)[0], 'MATCHED_PREFIX_PENDING')
        drifted = [dict(row) for row in rows]
        drifted[41]['checksum'] = '0' + drifted[41]['checksum'][1:]
        with self.assertRaisesRegex(RuntimeError, 'HISTORICAL_CHECKSUM_DRIFT'):
            ro.classify_registry(drifted, manifest)
        gapped = [row for row in rows if row['name'] != REAL_FILES[39].name]
        with self.assertRaisesRegex(RuntimeError, 'MIGRATION_HISTORY_GAP'):
            ro.classify_registry(gapped, manifest)
        unknown = rows + [{'name': '0073_intruder.sql', 'checksum': 'e' * 64}]
        with self.assertRaisesRegex(RuntimeError, 'UNKNOWN_EXTRA_MIGRATION'):
            ro.classify_registry(unknown, manifest)

    def test_postcheck_refuses_70_state(self):
        session = self.make_db('phase12c_drill_postcheck70')
        plan = ro.build_plan(MIGRATIONS, RELEASE_SHA, ro.read_registry(session))
        classification, _ = ro.classify_registry(ro.read_registry(session), plan['manifest'])
        self.assertNotEqual(classification, 'FULLY_MATCHED')

    def test_0071_commits_and_sabotaged_0072_fails_without_fake_registration(self):
        sabotage = self.base / 'sabotage'
        sabotage.mkdir()
        for path in REAL_FILES[:71]:
            shutil.copy(path, sabotage / path.name)
        broken = sabotage / '0072_production_return_guards.sql'
        broken.write_text((MIGRATIONS / '0072_production_return_guards.sql').read_text() + '\nSELECT 1/0;\n')
        session = self.make_db('phase12c_drill_partial')
        with self.assertRaisesRegex(ro.StopError, '0072'):
            self.run_execute(session, migrations=sabotage)
        state = json.loads((self.base / 'state' / 'orchestration-state.json').read_text())
        self.assertEqual(state['verdict'], 'STOPPED')
        self.assertEqual(state['stop_stage'], 'apply:0072_production_return_guards.sql')
        applied = self.verify_registry()
        self.assertEqual(len(applied), 71)
        self.assertNotIn('0072_production_return_guards.sql', applied)
        manifest = ro.read_manifest(MIGRATIONS)
        self.assertEqual(ro.classify_registry(ro.read_registry(self.sessions[-1]), manifest)[0], 'MATCHED_PREFIX_PENDING')
        plan = ro.build_plan(MIGRATIONS, RELEASE_SHA, ro.read_registry(self.sessions[-1]))
        evidence = self.base / 'evidence_rerun'
        write_evidence(evidence, pending=[p['name'] for p in plan['pending']])
        with self.assertRaisesRegex(RuntimeError, 'without --new-approval'):
            ro.run_stages(plan, evidence, session, sabotage, self.base / 'state')

    def test_connection_loss_mid_migration_stops_with_prefix_intact(self):
        sabotage = self.base / 'kill'
        sabotage.mkdir()
        for path in REAL_FILES[:71]:
            shutil.copy(path, sabotage / path.name)
        (sabotage / '0072_production_return_guards.sql').write_text('SELECT pg_terminate_backend(pg_backend_pid());\n')
        session = self.make_db('phase12c_drill_connloss')
        with self.assertRaisesRegex(ro.StopError, '0072'):
            self.run_execute(session, migrations=sabotage)
        state = json.loads((self.base / 'state' / 'orchestration-state.json').read_text())
        self.assertEqual(state['verdict'], 'STOPPED')
        followup = session_for(self.dbname)
        self.sessions.append(followup)
        self.assertEqual(len(self.registry_names(followup)), 71)

    def test_active_holder_session_blocks_at_quiescence_probe(self):
        # An idle-in-transaction holder on the target DB is an UNSETTLED writer:
        # the live quiescence probe must fail closed before any migration SQL.
        session = self.make_db('phase12c_drill_lock')
        holder = session_for(self.dbname)
        self.sessions.append(holder)
        holder.query('BEGIN; LOCK TABLE inventory_movements IN ACCESS EXCLUSIVE MODE;')
        with self.assertRaisesRegex(ro.StopError, 'FENCE_STATE_MISMATCH'):
            self.run_execute(session)
        self.assertEqual(len(self.verify_registry()), 70)
        state = json.loads((self.base / 'state' / 'orchestration-state.json').read_text())
        self.assertEqual(state['verdict'], 'STOPPED')

    def test_missing_evidence_leaves_registry_untouched(self):
        session = self.make_db('phase12c_drill_noevidence')
        empty = self.base / 'empty-evidence'
        empty.mkdir()
        plan = ro.build_plan(MIGRATIONS, RELEASE_SHA, ro.read_registry(session))
        with self.assertRaisesRegex(ro.StopError, 'release_approval'):
            ro.run_stages(plan, empty, session, MIGRATIONS, self.base / 'state')
        self.assertEqual(len(self.registry_names(session)), 70)

    def test_migration_assertions_reject_negative_stock_over_return_and_orphans(self):
        for name, fixture in (
            ('phase12c_drill_neg', 'neg'),
            ('phase12c_drill_over', 'over'),
            ('phase12c_drill_orphan', 'orphan'),
        ):
            with self.subTest(case=name):
                session = self.make_db(name)
                session.query("SET session_replication_role=replica; " + {
                    'neg': "INSERT INTO inventory_movements(id,tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','ISSUE','11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301',-5,now(),'MANUAL',gen_random_uuid(),rpad('a',64,'a'),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001','cccccccc-cccc-cccc-cccc-ccccccccc001')",
                    'over': "INSERT INTO production_material_transactions(id,tenant_id,production_order_id,transaction_type,item_version_id,lot_id,location_id,quantity,inventory_movement_id,reason,actor_id,correlation_id,idempotency_key,occurred_at,canonical_hash) VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444401','RETURN','11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301',9,gen_random_uuid(),'drill','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001','cccccccc-cccc-cccc-cccc-ccccccccc001','drill-over',now(),rpad('b',64,'b'))",
                    'orphan': "INSERT INTO inventory_movements(id,tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','RETURN','11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301',3,now(),'PRODUCTION_ORDER',gen_random_uuid(),rpad('c',64,'c'),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001','cccccccc-cccc-cccc-cccc-ccccccccc002')",
                }[fixture])
                with self.assertRaisesRegex(ro.StopError, 'DATA_PRECONDITION_MISMATCH'):
                    self.run_execute(session, state_name=f'state-{name}')
                state = json.loads((self.base / f'state-{name}' / 'orchestration-state.json').read_text())
                self.assertEqual(state['verdict'], 'STOPPED')
                self.assertEqual(state['stop_stage'], 'execute')
                self.assertEqual(len(self.verify_registry()), 70)
                self.teardown_db()


if __name__ == '__main__':
    unittest.main()
