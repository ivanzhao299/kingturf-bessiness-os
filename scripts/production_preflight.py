#!/usr/bin/env python3
"""Read-only production inventory gate; never print rendered configuration or credentials."""
import base64
from datetime import datetime, timedelta, timezone
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
    # Docker sends the application's stderr to docker-logs stderr as well.
    output = result.stdout + ('\n' + result.stderr if args[:2] == ['docker', 'logs'] else '')
    require(args[:2] != ['docker', 'logs'] or len(output) <= 65536, 'Failed startup log excerpt exceeds the bounded inspection limit')
    return output.strip()


NAME_PATTERN = re.compile(r'[0-9]{4}[0-9a-z_]*\.sql')
CHECKSUM_PATTERN = re.compile(r'[0-9a-f]{64}')


def validate_candidate_manifest(expected):
    require(isinstance(expected, dict) and expected and all(isinstance(k, str) and isinstance(v, str) and NAME_PATTERN.fullmatch(k) and CHECKSUM_PATTERN.fullmatch(v) for k, v in expected.items()), 'Invalid candidate migration manifest')
    ordered = sorted(expected)
    prefixes = [name[:4] for name in ordered]
    require(len(set(prefixes)) == len(prefixes) and prefixes == sorted(prefixes), 'Candidate migration manifest is not strictly ordered by unique numeric prefix')
    return ordered


def classify_registry(rows, expected):
    """Classify the applied registry against the candidate manifest.

    The applied set must be a complete, checksum-identical, contiguous prefix of the
    candidate sequence. Returns (classification, pending) where pending is the list of
    {name, checksum} still to apply. Fails closed with category-specific errors.
    """
    ordered = validate_candidate_manifest(expected)
    require(isinstance(rows, list), 'INVALID_REGISTRY: production registry is not a list')
    seen = set()
    for row in rows:
        require(isinstance(row, dict) and set(row) <= {'name', 'checksum'} and isinstance(row.get('name'), str) and isinstance(row.get('checksum'), str), 'INVALID_REGISTRY: registry row is malformed')
        require(NAME_PATTERN.fullmatch(row['name']) and CHECKSUM_PATTERN.fullmatch(row['checksum']), 'INVALID_REGISTRY: registry row name or checksum format invalid')
        require(row['name'] not in seen, 'DUPLICATE_MIGRATION: ' + row['name'])
        seen.add(row['name'])
    applied = [row['name'] for row in rows]
    require(applied == sorted(applied), 'INVALID_MIGRATION_ORDER: applied registry is not in migration order')
    unknown = [name for name in applied if name not in expected]
    require(not unknown, 'UNKNOWN_EXTRA_MIGRATION: ' + ', '.join(unknown))
    missing_prefix = [name for name in ordered[:len(applied)] if name not in seen]
    require(not missing_prefix, 'MIGRATION_HISTORY_GAP: missing applied prefix migration(s): ' + ', '.join(missing_prefix))
    require(applied == ordered[:len(applied)], 'INVALID_MIGRATION_ORDER: applied registry is not the contiguous candidate prefix')
    for row in rows:
        require(row['checksum'] == expected[row['name']], 'HISTORICAL_CHECKSUM_DRIFT: production migration checksums do not match candidate for ' + row['name'])
    pending = [{'name': name, 'checksum': expected[name]} for name in ordered[len(applied):]]
    classification = 'FULLY_MATCHED' if not pending else 'MATCHED_PREFIX_PENDING'
    return classification, pending


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
    for service in ('api', 'web'):
        image = config['services'][service].get('image', '')
        require(re.fullmatch(r'[^@\s]+@sha256:[0-9a-f]{64}', image), f'{service} image must be digest-pinned (image@sha256:<64hex>)')


def handover_state(classification, marker, candidate_sha, api_stopped):
    """Migration->application handover guard: the registry already matches the
    candidate manifest while the marker still names the previous release and
    the api container is actually stopped. A running api with the same
    registry shape is a plain application-only release and keeps the strict
    path (ruling 9: zero-migration releases share that registry shape)."""
    return candidate_sha is not None and classification == 'FULLY_MATCHED' and marker != candidate_sha and api_stopped


def inventory(root, expected):
    """Shared read-only storage/config/registry checks, in their original order."""
    require(Path(root) == RELEASE, 'Unexpected release directory')
    require(isinstance(expected, dict) and expected and all(isinstance(k, str) and isinstance(v, str) and re.fullmatch(r'[0-9]{4}.*\.sql', k) and re.fullmatch(r'[0-9a-f]{64}', v) for k, v in expected.items()), 'Invalid candidate migration manifest')
    require(command(['findmnt', '-n', '-T', '/data', '-o', 'TARGET']) == '/data', '/data must be an actual mounted filesystem')
    for path in (RELEASE, POSTGRES, ATTACHMENTS):
        require(path.is_dir() and path.resolve() == path, 'Approved existing storage directory missing or redirected')
        require(os.stat(path).st_dev == os.stat('/data').st_dev, 'Persistent directory is outside the approved data disk')
    require(shutil.disk_usage('/data').free >= 5 * 1024 ** 3, 'Data disk below minimum free-space floor; backup sizing still requires operator evidence')
    # A4-P1-2 (A-F1)：权限收紧断言（伪环境不落盘该文件时由 compose 装配兜底校验存在性）。
    env_prod = RELEASE / '.env.production'
    if env_prod.exists():
        require((os.stat(env_prod).st_mode & 0o777) <= 0o600,
                '.env.production permissions are broader than 0600')
    compose = ['docker', 'compose', '--env-file', str(RELEASE / '.env.production'), '-f', str(RELEASE / 'infra/docker/compose.production.yaml')]
    config = json.loads(command(compose + ['config', '--format', 'json']))
    validate_config(config)
    # Validate the actual existing containers; a new empty named volume is never an acceptable fallback.
    sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'checksum',checksum) ORDER BY name),'[]'::jsonb) FROM schema_migrations; COMMIT;\n"
    rows = json.loads(command(compose + ['exec', '-T', 'postgres', 'sh', '-c', 'exec psql -X -qAt -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'], text=sql))
    classification, pending = classify_registry(rows, expected)
    return config, rows, classification, pending


FORWARD_SOURCE_TTL = 300


def json_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def forward_source_identity(source):
    return {k: v for k, v in source.items() if k not in ('observed_at_utc', 'expires_at_utc')}


def validate_forward_source(source, expected, candidate_sha, now=None):
    require(isinstance(source, dict) and source.get('kind') == 'failed_api_forward_recovery_v1', 'Invalid forward recovery source record')
    require(source.get('candidate_sha') == candidate_sha and source.get('manifest_sha256') == json_digest(expected), 'Forward recovery candidate or manifest mismatch')
    now = now or datetime.now(timezone.utc)
    start, end = [datetime.fromisoformat(source[k].replace('Z', '+00:00')) for k in ('observed_at_utc', 'expires_at_utc')]
    require(all(t.tzinfo is not None and t.utcoffset().total_seconds() == 0 for t in (start, end)), 'Forward recovery source timestamps must be UTC')
    require(start <= now < end and 0 < (end-start).total_seconds() <= FORWARD_SOURCE_TTL, 'Forward recovery source record expired or invalid')


def failed_startup_proof(container, expected):
    """Require an actual failed startup, never authorize stop from unhealthy alone.

    Logs stay in memory. Only the matched migration names and a line digest leave
    this function; arbitrary runtime log contents must never enter public evidence.
    """
    state = container['State']
    status = state.get('Status')
    require(status in ('restarting', 'exited') and type(state.get('ExitCode')) is int and state['ExitCode'] != 0, 'Forward recovery requires a failed API startup')
    require(state.get('Restarting') is (status == 'restarting') and (status != 'exited' or state.get('Running') is False), 'Forward recovery API state is inconsistent')
    require(not state.get('Paused') and not state.get('Dead') and state.get('Health', {}).get('Status') != 'healthy', 'Healthy or ambiguous API cannot enter forward recovery')
    started = state.get('StartedAt')
    require(isinstance(started, str) and re.fullmatch(r'[0-9T:.Z+\-]+', started), 'Failed startup timestamp missing')
    logs = command(['docker', 'logs', '--tail', '100', '--since', started, container['Id']])
    for line in logs.splitlines():
        match = re.search(r'Migration compatibility check failed: ([0-9a-z_.:, ]+)', line)
        if match:
            entries = match[1].strip().split(', ')
            names = [entry.removesuffix(':drifted') for entry in entries]
            if entries and all(entry.endswith(':drifted') and name in expected for entry, name in zip(entries, names)):
                return {'reason': 'startup_migration_compatibility', 'migrations': names, 'line_sha256': hashlib.sha256(match[0].encode()).hexdigest()}
    raise RuntimeError('Failed API has no matching migration startup failure proof')


def inspect_forward_recovery(root, expected, candidate_sha):
    """Inspection ONLY: this result is not a deployment preflight PASS."""
    require(isinstance(candidate_sha, str) and re.fullmatch(r'[0-9a-f]{40}', candidate_sha), 'Forward recovery candidate sha required')
    _, rows, classification, pending = inventory(root, expected)
    require(classification == 'FULLY_MATCHED' and not pending, 'Forward recovery requires FULLY_MATCHED with zero pending')
    marker = (RELEASE / '.release-sha').read_text().strip()
    require(re.fullmatch(r'[0-9a-f]{40}', marker) and marker != candidate_sha, 'Forward recovery requires a different valid previous marker')
    containers = {}
    for service, target, source in (('postgres', '/var/lib/postgresql/data', POSTGRES), ('api', '/var/lib/kingturf/attachments', ATTACHMENTS), ('web', None, None)):
        ids = command(['docker', 'container', 'ls', '-aq', '--filter', f'label=com.docker.compose.project={PROJECT}', '--filter', f'label=com.docker.compose.service={service}']).splitlines()
        require(len(ids) == 1, 'Expected exactly one existing container per production service')
        container = json.loads(command(['docker', 'inspect', ids[0]]))[0]
        labels = container['Config']['Labels']
        require(labels.get('com.docker.compose.project') == PROJECT and labels.get('com.docker.compose.service') == service, 'Forward recovery container project/service mismatch')
        if target:
            mounts = [m for m in container['Mounts'] if m['Destination'] == target]
            require(len(mounts) == 1 and mounts[0]['Type'] == 'bind' and Path(mounts[0]['Source']) == source, 'Live persistent mount disagrees with approved configuration')
        if service != 'api':
            require(container['State'].get('Running') and not container['State'].get('Restarting'), 'Forward recovery requires running postgres and web')
        if service == 'postgres':
            require(container['State'].get('Health', {}).get('Status') == 'healthy', 'Forward recovery requires healthy postgres')
        containers[service] = container
    api = containers['api']
    release_values = [v.partition('=')[2] for v in api['Config']['Env'] if v.startswith('KINGTURF_RELEASE_SHA=')]
    require(release_values == [marker], 'Failed API old release disagrees with marker')
    require(re.fullmatch(r'[0-9a-f]{64}', api['Id']) and re.fullmatch(r'sha256:[0-9a-f]{64}', api['Image']), 'Forward recovery API identity malformed')
    proof = failed_startup_proof(api, expected)
    command(['docker', 'image', 'inspect', api['Image']])
    now = datetime.now(timezone.utc)
    state = api['State']
    return {
        'kind': 'failed_api_forward_recovery_v1', 'candidate_sha': candidate_sha,
        'manifest_sha256': json_digest(expected), 'registry_sha256': json_digest(rows),
        'marker': marker, 'old_release_sha': release_values[0],
        'api_container_id': api['Id'], 'api_image_id': api['Image'], 'api_image_ref': api['Config']['Image'],
        'state': {k: state.get(k) for k in ('Status', 'Running', 'Restarting', 'ExitCode', 'StartedAt', 'FinishedAt', 'OOMKilled')},
        'restart_count': api.get('RestartCount'), 'failure': proof,
        'observed_at_utc': now.isoformat(), 'expires_at_utc': (now + timedelta(seconds=FORWARD_SOURCE_TTL)).isoformat(),
    }


def preflight(root, expected, *, require_full=False, allow_stopped_api=False, candidate_sha=None):
    config, rows, classification, pending = inventory(root, expected)
    marker = (RELEASE / '.release-sha').read_text().strip()
    require(re.fullmatch(r'[0-9a-f]{40}', marker), 'Previous release marker is missing or invalid')
    # Migration->application handover: registry already matches the candidate manifest
    # while the marker still names the previous release; the migration run leaves the
    # api deliberately stopped in that state (window mode applies).
    # Ruling 9: the same registry shape also occurs for zero-migration application
    # releases where the api is running normally, so the relaxation additionally
    # requires the api container to be actually stopped (not merely restarting);
    # otherwise the strict path below (health checks + version probe) stays in force.
    api_ids = command(['docker', 'container', 'ls', '-aq', '--filter', f'label=com.docker.compose.project={PROJECT}', '--filter', f'label=com.docker.compose.service=api']).splitlines()
    require(len(api_ids) == 1, 'Expected exactly one existing container per production service')
    api_state = json.loads(command(['docker', 'inspect', api_ids[0]]))[0]['State']
    api_stopped = not api_state.get('Running') and not api_state.get('Restarting')
    api_fenced = False
    for service, target, source in (
        ('postgres', '/var/lib/postgresql/data', POSTGRES),
        ('api', '/var/lib/kingturf/attachments', ATTACHMENTS),
        ('web', None, None),
    ):
        ids = command(['docker', 'container', 'ls', '-aq', '--filter', f'label=com.docker.compose.project={PROJECT}', '--filter', f'label=com.docker.compose.service={service}']).splitlines()
        require(len(ids) == 1, 'Expected exactly one existing container per production service')
        container = json.loads(command(['docker', 'inspect', ids[0]]))[0]
        running = container['State'].get('Running')
        healthy = container['State'].get('Health', {}).get('Status') == 'healthy'
        # Window mode: a controlled old-api shutdown fence legitimately stops the api
        # container before the deploy workflow starts. web's /health proxies the api,
        # so its healthcheck fails transitively (502) and is tolerated as well, only
        # while the api fence is actually observed. Stage B's evidence gates and the
        # orchestrator's live docker/quiescence probes still enforce the fence.
        window_mode = allow_stopped_api or handover_state(classification, marker, candidate_sha, api_stopped)
        fenced_api_stopped = window_mode and service == 'api' and not running
        fenced_web_transitive = window_mode and service == 'web' and running and api_fenced
        require((running and healthy) or fenced_api_stopped or fenced_web_transitive, 'Existing production container is not healthy')
        api_fenced = api_fenced or fenced_api_stopped
        if target:
            mounts = [m for m in container['Mounts'] if m['Destination'] == target]
            require(len(mounts) == 1 and mounts[0]['Type'] == 'bind' and Path(mounts[0]['Source']) == source, 'Live persistent mount disagrees with approved configuration')
    if require_full:
        require(classification == 'FULLY_MATCHED', 'Post-migration check failed: registry is not FULLY_MATCHED; pending migrations remain')
    port = config['services']['web']['ports'][0]['published']
    require(str(port).isdigit(), 'Production ingress port invalid')
    if allow_stopped_api or handover_state(classification, marker, candidate_sha, api_stopped):
        # The version endpoint is served by the (stopped) old api; the fence evidence's
        # api_release_sha and the pre-stop marker reading cover the version binding.
        print(json.dumps({'preflight': 'PASS', 'registry_classification': classification, 'previous_sha': marker, 'applied': len(rows), 'pending': pending, 'services': 3, 'storage': 'approved_bind_mounts', 'restore': 'REQUIRES_INDEPENDENT_EVIDENCE', 'version_probe': 'skipped (window mode: api stopped by write fence)'}))
        return
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/version', timeout=10) as reply:
        version = json.load(reply)
    require(version.get('sha') == marker, 'Actual runtime version disagrees with previous verified marker; investigate before retry')
    print(json.dumps({'preflight': 'PASS', 'registry_classification': classification, 'previous_sha': marker, 'applied': len(rows), 'pending': pending, 'services': 3, 'storage': 'approved_bind_mounts', 'restore': 'REQUIRES_INDEPENDENT_EVIDENCE'}))


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--manifest':
        files = sorted(Path(sys.argv[2]).glob('[0-9][0-9][0-9][0-9]*.sql'))
        require(bool(files), 'Candidate migration files missing')
        value = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
        print(base64.b64encode(json.dumps(value).encode()).decode())
    elif len(sys.argv) >= 3 and sys.argv[1] != '--manifest':
        expected = json.loads(base64.b64decode(sys.argv[2], validate=True))
        flags = sys.argv[3:]
        require(all(flag in ('--require-full', '--allow-stopped-api', '--inspect-forward-recovery') or flag.startswith('--candidate-sha=') for flag in flags), 'unknown preflight flag')
        candidate_sha = next((flag.split('=', 1)[1] for flag in flags if flag.startswith('--candidate-sha=')), None)
        require(candidate_sha is None or re.fullmatch(r'[0-9a-f]{40}', candidate_sha), 'candidate sha must be 40 lowercase hex')
        if '--inspect-forward-recovery' in flags:
            require('--require-full' in flags and '--allow-stopped-api' not in flags, 'Forward inspection requires full matching and cannot relax startup checks')
            print(json.dumps(inspect_forward_recovery(sys.argv[1], expected, candidate_sha), sort_keys=True))
        else:
            preflight(sys.argv[1], expected, require_full='--require-full' in flags, allow_stopped_api='--allow-stopped-api' in flags, candidate_sha=candidate_sha)
    elif len(sys.argv) == 3:
        expected = json.loads(base64.b64decode(sys.argv[2], validate=True))
        preflight(sys.argv[1], expected)
    else:
        raise RuntimeError('Usage: production_preflight.py --manifest <directory> OR <release-path> <manifest-base64> [--require-full] [--allow-stopped-api]')


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
