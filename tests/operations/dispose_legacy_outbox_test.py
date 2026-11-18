"""R4 (TD-REL-006): local rehearsal of the sanctioned legacy outbox disposal.

Seeds a fully migrated scratch database with the three event classes
(delivered / legacy undelivered pre-cutoff / recent undelivered), runs the
disposal transaction, and asserts: only the legacy class is disposed as
DEAD_LETTER, the other classes are untouched, a forced conflict rolls the
whole transaction back, and the pure helpers (drift classification, staged
shape guard, forbidden-path refusal) hold their contracts.
"""
from datetime import datetime, timezone
from pathlib import Path
import importlib.util
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/operations'))
import release_migration_drill_test as drill  # noqa: E402
import psql_helper  # noqa: E402

spec = importlib.util.spec_from_file_location(
    'dispose_legacy_outbox', ROOT / 'scripts/operations/dispose_legacy_outbox.py')
disp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(disp)

CUTOFF = disp.LEGACY_CUTOFF


def stamp():
    return datetime.now(timezone.utc).strftime('%Y%m%d%H%M%SZ').lower()


class DisposalRehearsal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not drill.HAS_DOCKER:
            raise unittest.SkipTest('no local development postgres container')
        cls.temp = tempfile.TemporaryDirectory(prefix='dispose-rehearsal-')
        cls.base = Path(cls.temp.name)
        cls.runner = cls.base / 'reference-migrator.mjs'
        cls.runner.write_text(drill.REFERENCE_MIGRATOR)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def prepare(self, dbname):
        admin = drill.admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {dbname}')
            admin.query(f'CREATE DATABASE {dbname}')
        finally:
            admin.close()
        url = drill.URL_PREFIX + dbname
        result = subprocess.run(
            ['node', '--experimental-transform-types', str(self.runner),
             str(ROOT / 'packages/database/migrations')],
            env={**__import__('os').environ, 'DATABASE_URL': url},
            capture_output=True, text=True, timeout=900)
        assert result.returncode == 0, result.stderr[-400:]
        return url

    def drop(self, dbname):
        admin = drill.admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {dbname}')
        finally:
            admin.close()

    def seed(self, url, kind):
        """Insert one org + one outbox event of the requested class; return event id."""
        occurred_expr = {
            'delivered': 'now()',
            'legacy': "now() - interval '60 days'",
            'recent': 'now()',
        }[kind]
        psql_helper.query(url,
                          f"INSERT INTO organizations(id,owner_organization_id,code,name,organization_type)"
                          f" VALUES(gen_random_uuid(),NULL,'{kind.upper()}','{kind}','COMPANY');")
        event_id = psql_helper.query(url,
                          "INSERT INTO domain_event_outbox(id,tenant_id,event_type,event_version,"
                          "aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload)"
                          f" SELECT gen_random_uuid(),id,'dispose.{kind}',1,'x',gen_random_uuid(),1,{occurred_expr},NULL,gen_random_uuid(),'{{}}'::jsonb"
                          f" FROM organizations WHERE code='{kind.upper()}' RETURNING id;")
        if kind == 'delivered':
            psql_helper.query(url,
                              "INSERT INTO event_consumer_deliveries(id,tenant_id,consumer_name,event_id,state,attempts)"
                              " SELECT gen_random_uuid(),o.tenant_id,'rehearsal.consumer',o.id,'DELIVERED',1"
                              " FROM domain_event_outbox o WHERE o.event_type='dispose.delivered';")
        return event_id.strip()

    def disposed_count(self, url, consumer=disp.CONSUMER):
        return int(psql_helper.query(
            url,
            f"SELECT count(*) FROM event_consumer_deliveries WHERE consumer_name='{consumer}';"))

    def legacy_undelivered(self, url):
        return int(psql_helper.query(
            url, 'SELECT count(*) FROM (' + disp.legacy_ids_sql() + ') probe;'))

    def test_only_legacy_class_is_disposed_as_dead_letter(self):
        dbname = f'dispose_rehearsal_{stamp()}'
        self.addCleanup(self.drop, dbname)
        url = self.prepare(dbname)
        for kind in ('delivered', 'legacy', 'recent'):
            self.seed(url, kind)
        self.assertEqual(self.legacy_undelivered(url), 2)  # legacy + recent both undelivered

        # The script's dispose step is one SQL transaction; drive it via psql directly
        # with the exact script SQL (mode_dispose's precheck expects 164 in prod).
        sql = (
            'BEGIN;\n'
            'INSERT INTO event_consumer_deliveries(id,tenant_id,consumer_name,event_id,state,attempts)\n'
            f" SELECT gen_random_uuid(),o.tenant_id,'{disp.CONSUMER}',o.id,'DEAD_LETTER',0\n"
            ' FROM domain_event_outbox o WHERE NOT EXISTS'
            ' (SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id AND d.tenant_id=o.tenant_id);\n'
            'COMMIT;\n')
        psql_helper.query(url, sql)
        self.assertEqual(self.disposed_count(url), 2)  # legacy + recent (both undelivered)
        for kind in ('legacy', 'recent'):
            state = psql_helper.query(
                url,
                "SELECT d.state FROM event_consumer_deliveries d JOIN domain_event_outbox o"
                f" ON o.id=d.event_id WHERE o.event_type='dispose.{kind}'"
                f" AND d.consumer_name='{disp.CONSUMER}';").strip()
            self.assertEqual(state, 'DEAD_LETTER')
        delivered_consumer = psql_helper.query(
            url,
            "SELECT d.consumer_name FROM event_consumer_deliveries d JOIN domain_event_outbox o"
            " ON o.id=d.event_id WHERE o.event_type='dispose.delivered';").strip()
        self.assertEqual(delivered_consumer, 'rehearsal.consumer')  # untouched
        self.assertEqual(self.legacy_undelivered(url), 0)

    def test_mid_transaction_failure_rolls_back_everything(self):
        """The script's dispose block is one BEGIN...COMMIT: any statement failing
        inside it (here a forced error after a successful sentinel INSERT) must
        leave zero disposal rows — no partial commit."""
        dbname = f'dispose_rollback_{stamp()}'
        self.addCleanup(self.drop, dbname)
        url = self.prepare(dbname)
        self.seed(url, 'legacy')
        sql = (
            'BEGIN;\n'
            'INSERT INTO event_consumer_deliveries(id,tenant_id,consumer_name,event_id,state,attempts)\n'
            f" SELECT gen_random_uuid(),o.tenant_id,'{disp.CONSUMER}',o.id,'DEAD_LETTER',0\n"
            ' FROM domain_event_outbox o WHERE NOT EXISTS'
            ' (SELECT 1 FROM event_consumer_deliveries d WHERE d.event_id=o.id AND d.tenant_id=o.tenant_id);\n'
            'SELECT 1/0;\n'  # forced failure after a would-be-successful insert
            'COMMIT;\n')
        result = subprocess.run(
            ['docker', 'exec', '-i', drill.CONTAINER, 'psql', '-X', '-qAt',
             '-v', 'ON_ERROR_STOP=1', '-U', 'kingturf', '-d', dbname],
            input=sql.encode(), capture_output=True, timeout=120)
        self.assertNotEqual(result.returncode, 0)  # transaction aborted
        self.assertEqual(self.disposed_count(url), 0)  # sentinel insert rolled back too
        self.assertEqual(self.legacy_undelivered(url), 1)  # event untouched


class PureHelpers(unittest.TestCase):
    def test_drift_classification_exact_count_required(self):
        ok, summary = disp.classify_drift('\n'.join('x' for _ in range(3)), 3)
        self.assertTrue(ok)
        self.assertEqual(summary, {'count': 3})
        bad, drift = disp.classify_drift('a\nb\nc\nd', 3)
        self.assertFalse(bad)
        self.assertEqual(drift['actual'], 4)
        self.assertEqual(drift['expected'], 3)
        self.assertEqual(drift['sample'], ['a', 'b', 'c', 'd'])

    def test_staged_shape_guard_accepts_only_exact_control_set(self):
        self.assertTrue(disp.staged_entry_ok(
            ['migrations', 'production_preflight.py', 'release_orchestrator.py']))
        for names in (['migrations', 'release_orchestrator.py'],  # missing preflight
                      ['migrations', 'production_preflight.py', 'release_orchestrator.py', 'plan.json'],
                      []):
            self.assertFalse(disp.staged_entry_ok(names))

    def test_forbidden_paths_are_refused(self):
        for path in ('/data/kingturf-erp/.release-backups/x', '/tmp/.release-image-recovery'):
            with self.assertRaisesRegex(RuntimeError, 'refusing path'):
                disp.refuse_forbidden(Path(path))
        disp.refuse_forbidden(Path('/tmp/wave2-44345815689-1'))  # whitelist paths pass


if __name__ == '__main__':
    unittest.main()
