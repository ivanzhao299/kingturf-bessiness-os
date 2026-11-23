"""Unit coverage for the drill container resolution (no PostgreSQL or Docker needed)."""
import subprocess
import unittest
from unittest import mock

import psql_helper

ISOLATED = 'postgresql://kingturf:local-development-only@localhost:5438/kingturf_test_coordrel'
COMPOSE = 'postgresql://kingturf:local-development-only@localhost:5432/kingturf_test'


def docker_ps(stdout='', returncode=0):
    return subprocess.CompletedProcess(['docker', 'ps'], returncode, stdout, '')


class ContainerForTests(unittest.TestCase):
    def test_compose_port_keeps_the_compose_service_without_asking_docker(self):
        with mock.patch.object(psql_helper.subprocess, 'run') as run:
            self.assertEqual(psql_helper.container_for(COMPOSE), psql_helper.COMPOSE_CONTAINER)
            self.assertEqual(psql_helper.container_for('postgresql://kingturf@localhost/kingturf_test'), psql_helper.COMPOSE_CONTAINER)
            self.assertEqual(psql_helper.container_for('postgresql://kingturf@db.internal:5432/kingturf_test'), psql_helper.COMPOSE_CONTAINER)
        run.assert_not_called()

    def test_no_url_keeps_the_compose_service(self):
        with mock.patch.object(psql_helper.subprocess, 'run') as run:
            self.assertEqual(psql_helper.container_for(None), psql_helper.COMPOSE_CONTAINER)
            self.assertEqual(psql_helper.container_for(''), psql_helper.COMPOSE_CONTAINER)
        run.assert_not_called()

    def test_other_port_resolves_the_container_publishing_it(self):
        listing = 'kingturf-pg-proc2\t127.0.0.1:5437->5432/tcp\nkingturf-pg-coordrel\t127.0.0.1:5438->5432/tcp\n'
        with mock.patch.object(psql_helper.shutil, 'which', return_value='/usr/bin/docker'), \
                mock.patch.object(psql_helper.subprocess, 'run', return_value=docker_ps(listing)) as run:
            self.assertEqual(psql_helper.container_for(ISOLATED), 'kingturf-pg-coordrel')
        run.assert_called_once_with(
            ['docker', 'ps', '--filter', 'publish=5438', '--format', '{{.Names}}\t{{.Ports}}'],
            capture_output=True, text=True, timeout=30)

    def test_other_port_without_a_container_is_unknown_not_the_compose_service(self):
        with mock.patch.object(psql_helper.shutil, 'which', return_value='/usr/bin/docker'), \
                mock.patch.object(psql_helper.subprocess, 'run', return_value=docker_ps()):
            self.assertIsNone(psql_helper.container_for('postgresql://kingturf@localhost:5439/kingturf_test'))

    def test_ambiguous_listing_is_unknown(self):
        listing = 'a\t127.0.0.1:5438->5432/tcp\nb\t0.0.0.0:5438->5432/tcp\n'
        with mock.patch.object(psql_helper.shutil, 'which', return_value='/usr/bin/docker'), \
                mock.patch.object(psql_helper.subprocess, 'run', return_value=docker_ps(listing)):
            self.assertIsNone(psql_helper.container_for(ISOLATED))

    def test_docker_failure_or_absence_is_unknown(self):
        with mock.patch.object(psql_helper.shutil, 'which', return_value='/usr/bin/docker'), \
                mock.patch.object(psql_helper.subprocess, 'run', return_value=docker_ps('', 1)):
            self.assertIsNone(psql_helper.container_for(ISOLATED))
        with mock.patch.object(psql_helper.shutil, 'which', return_value=None), \
                mock.patch.object(psql_helper.subprocess, 'run') as run:
            self.assertIsNone(psql_helper.container_for(ISOLATED))
        run.assert_not_called()


class UserForTests(unittest.TestCase):
    def test_user_follows_the_url_with_the_compose_default(self):
        self.assertEqual(psql_helper.user_for(ISOLATED), 'kingturf')
        self.assertEqual(psql_helper.user_for('postgresql://someone@localhost:5438/x'), 'someone')
        self.assertEqual(psql_helper.user_for(None), 'kingturf')


if __name__ == '__main__':
    unittest.main()
