#!/usr/bin/env python3
"""Read-only production inventory gate; never print rendered configuration or credentials."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.request

PROJECT = 'kingturf-erp-production'
RELEASE = Path('/data/kingturf-erp')
POSTGRES = Path('/data/kingturf-erp-data/postgres')
ATTACHMENTS = Path('/data/kingturf-erp-data/attachments')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def command(args, *, text=None):
    result = subprocess.run(args, input=text, capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, 'Required read-only inventory command failed')
    return result.stdout.strip()


def validate_config(config):
    require(config.get('name') == PROJECT, 'Unexpected Compose project')
    for service, target, expected in (
        ('postgres', '/var/lib/postgresql/data', POSTGRES),
        ('api', '/var/lib/kingturf/attachments', ATTACHMENTS),
    ):
        mounts = [v for v in config['services'][service].get('volumes', []) if v['target'] == target]
        require(len(mounts) == 1, 'Required persistent mount absent or ambiguous')
        mount = mounts[0]
        require(mount['type'] == 'bind' and Path(mount['source']) == expected, 'Persistent storage must use the approved bind path')
    api = config['services']['api']['environment']
    for key in ('DATABASE_URL', 'SESSION_SECRET', 'WEBSITE_LEAD_INGEST_SECRET'):
        require(bool(api.get(key)), 'Required API configuration missing')
    require(len(api['SESSION_SECRET']) >= 32 and len(api['WEBSITE_LEAD_INGEST_SECRET']) >= 32, 'Required security configuration invalid')


def preflight(root, expected):
    require(Path(root) == RELEASE, 'Unexpected release directory')
    require(isinstance(expected, dict) and expected and all(isinstance(k, str) and isinstance(v, str) and re.fullmatch(r'[0-9]{4}.*\.sql', k) and re.fullmatch(r'[0-9a-f]{64}', v) for k, v in expected.items()), 'Invalid candidate migration manifest')
    require(command(['findmnt', '-n', '-T', '/data', '-o', 'TARGET']) == '/data', '/data must be an actual mounted filesystem')
    for path in (RELEASE, POSTGRES, ATTACHMENTS):
        require(path.is_dir() and path.resolve() == path, 'Approved existing storage directory missing or redirected')
        require(os.stat(path).st_dev == os.stat('/data').st_dev, 'Persistent directory is outside the approved data disk')
    require(shutil.disk_usage('/data').free >= 5 * 1024 ** 3, 'Data disk below minimum free-space floor; backup sizing still requires operator evidence')
    compose = ['docker', 'compose', '--env-file', str(RELEASE / '.env.production'), '-f', str(RELEASE / 'infra/docker/compose.production.yaml')]
    config = json.loads(command(compose + ['config', '--format', 'json']))
    validate_config(config)
    # Validate the actual existing containers; a new empty named volume is never an acceptable fallback.
    for service, target, source in (
        ('postgres', '/var/lib/postgresql/data', POSTGRES),
        ('api', '/var/lib/kingturf/attachments', ATTACHMENTS),
        ('web', None, None),
    ):
        ids = command(['docker', 'container', 'ls', '-aq', '--filter', f'label=com.docker.compose.project={PROJECT}', '--filter', f'label=com.docker.compose.service={service}']).splitlines()
        require(len(ids) == 1, 'Expected exactly one existing container per production service')
        container = json.loads(command(['docker', 'inspect', ids[0]]))[0]
        require(container['State'].get('Running') and container['State'].get('Health', {}).get('Status') == 'healthy', 'Existing production container is not healthy')
        if target:
            mounts = [m for m in container['Mounts'] if m['Destination'] == target]
            require(len(mounts) == 1 and mounts[0]['Type'] == 'bind' and Path(mounts[0]['Source']) == source, 'Live persistent mount disagrees with approved configuration')
    sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT coalesce(jsonb_object_agg(name,checksum),'{}'::jsonb) FROM schema_migrations; COMMIT;\n"
    actual = json.loads(command(compose + ['exec', '-T', 'postgres', 'sh', '-c', 'exec psql -X -qAt -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'], text=sql))
    require(actual == expected, 'Production registry is not exactly compatible with candidate migration checksums')
    marker = (RELEASE / '.release-sha').read_text().strip()
    require(re.fullmatch(r'[0-9a-f]{40}', marker), 'Previous release marker is missing or invalid')
    port = config['services']['web']['ports'][0]['published']
    require(str(port).isdigit(), 'Production ingress port invalid')
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/version', timeout=10) as reply:
        version = json.load(reply)
    require(version.get('sha') == marker, 'Actual runtime version disagrees with previous verified marker; investigate before retry')
    print(json.dumps({'preflight': 'PASS', 'previous_sha': marker, 'migrations': len(expected), 'services': 3, 'storage': 'approved_bind_mounts', 'restore': 'REQUIRES_INDEPENDENT_EVIDENCE'}))


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--manifest':
        files = sorted(Path(sys.argv[2]).glob('[0-9][0-9][0-9][0-9]*.sql'))
        require(bool(files), 'Candidate migration files missing')
        value = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
        print(base64.b64encode(json.dumps(value).encode()).decode())
    elif len(sys.argv) == 3:
        expected = json.loads(base64.b64decode(sys.argv[2], validate=True))
        preflight(sys.argv[1], expected)
    else:
        raise RuntimeError('Usage: production_preflight.py --manifest <directory> OR <release-path> <manifest-base64>')


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as error:
        print("Production read-only preflight failed: " + str(error), file=sys.stderr)
        sys.exit(1)
    except (KeyError, TypeError, ValueError, OSError, subprocess.TimeoutExpired):
        # Rendered compose/inspect output may contain secrets; do not echo exception payloads.
        print('Production read-only preflight failed; no backup/sync/deploy authorized', file=sys.stderr)
        sys.exit(1)
