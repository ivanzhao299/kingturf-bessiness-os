#!/usr/bin/env python3
"""72-schema application release only. Never invokes a migration executor or DDL."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
import re
import subprocess
import tarfile
import time
import urllib.request

import oci_image_transport as images

ROOT = Path('/data/kingturf-erp')
PROJECT = 'kingturf-erp-production'
REGISTRY_SQL = "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT jsonb_agg(jsonb_build_object('name',name,'checksum',checksum,'applied_at',applied_at) ORDER BY name) FROM schema_migrations; COMMIT;"


def command(args, *, data=None, timeout=120, env=None):
    p = subprocess.run(args, input=data, capture_output=True, timeout=timeout, env=env)
    images.require(p.returncode == 0, 'Application release operation failed: ' + ' '.join(map(str, args[:3])))
    return p.stdout


def compose(*args, env=None):
    return command(['docker', 'compose', '--project-directory', str(ROOT), '--env-file', str(ROOT / '.env.production'), '-f', str(ROOT / 'infra/docker/compose.production.yaml'), *args], env=env)


def registry_snapshot():
    return json.loads(command(['docker', 'exec', '-i', PROJECT + '-postgres-1', 'sh', '-c', 'exec psql -X -qAt -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'], data=REGISTRY_SQL.encode()))


def state_hashes():
    return {str(p.relative_to(ROOT)): images.checksum(p) for p in sorted((ROOT / '.release-migration-state').rglob('*')) if p.is_file()}


def probe(base, sha):
    for path, key, value in (('health', 'status', 'ok'), ('ready', 'status', 'ready'), ('version', 'sha', sha)):
        with urllib.request.urlopen(base + '/' + path, timeout=12) as reply:
            images.require(reply.status == 200 and json.load(reply).get(key) == value, 'Required application probe failed: ' + path)


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, sort_keys=True))
    temporary.replace(path)


def authorize(bundle, approval):
    auth = json.loads((bundle / 'authorization.json').read_bytes())
    images.require(auth.get('kind') == 'delegated_application_recovery' and auth.get('authorization_source_thread') == '01a1c9d5-653a-7bf0-a627-c2eab5ac0834', 'Application recovery authorization missing')
    images.require(auth.get('release_sha') == approval['release_sha'] == os.environ.get('RELEASE_SHA') and auth.get('control_sha') == os.environ.get('RELEASE_CONTROL_SHA') and re.fullmatch(r'[0-9a-f]{40}', auth.get('control_sha', '')), 'Authorization SHA mismatch')
    start, end = [datetime.fromisoformat(auth[k].replace('Z', '+00:00')) for k in ('started_at_utc', 'window_end_utc')]
    images.require(start.tzinfo is not None and end.tzinfo is not None and start.utcoffset().total_seconds() == end.utcoffset().total_seconds() == 0, 'Authorization timestamps must be UTC')
    now = datetime.now(timezone.utc)
    images.require(start <= now < end and 0 < (end-start).total_seconds() <= 12*3600, 'Application recovery window expired or invalid')
    images.require(auth.get('operator') == 'codex' and auth.get('migration_execution') == 'forbidden' and auth.get('smoke') == 'PASS', 'Invalid delegated operator scope')
    return auth


def handover_state(classification, marker, release_sha, api_stopped):
    """Migration->application handover: registry already matches the candidate
    manifest while the marker still names the previous release and the api
    container is actually stopped. Exactly this combination legitimately
    carries a deliberately stopped api container; a running api with the same
    registry shape is a plain application-only release and must stay strict
    (ruling 9: the same shape also occurs with zero pending migrations)."""
    return classification == 'FULLY_MATCHED' and marker != release_sha and api_stopped


def verify_image_evidence(root, approval, identities, auth):
    path = root / '.release-migration-evidence/image_compatibility.json'
    images.require(path.is_file(), 'Host image compatibility evidence missing')
    old = json.loads(path.read_bytes())
    if old.get('images_built_at') == approval['release_sha']:
        images.require(old.get('old_app_on_new_schema', {}).get('verified') is True and old['old_app_on_new_schema'].get('evidence'), 'Prior schema compatibility evidence missing')
        for service, i in identities.items():
            images.require(old.get(service + '_digest') == i['approved_digest'], 'Digest disagrees with prior approved image evidence')
    else:
        images.require(auth.get('smoke') == 'PASS', 'Newer candidate image evidence requires a passed runner isolation smoke')


def advance_image_evidence(root, bundle, approval, identities):
    directory = root / '.release-migration-evidence'
    images.require(directory.is_dir(), 'Host migration evidence directory missing')
    # Host bundle layout renames the runner artifact to bundle.tar.gz
    # (recover_application_images.sh rsync); accept either name defensively (TD-REL-004).
    archive = bundle / 'bundle.tar.gz'
    if not archive.is_file():
        archive = bundle / 'recovery-bundle.tar.gz'
    images.require(archive.is_file(), 'Recovery bundle archive missing for evidence advancement')
    value = {
        'images_built_at': approval['release_sha'],
        **{service + '_digest': i['approved_digest'] for service, i in identities.items()},
        'old_app_on_new_schema': {'verified': True, 'evidence': 'runner isolation smoke images_run_id=%s bundle=%s' % (bundle.name.split('-')[0], images.checksum(archive))},
    }
    path = directory / 'image_compatibility.json'
    temporary = path.with_suffix(path.suffix + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(json.dumps(value, sort_keys=True))
    temporary.replace(path)


def precheck(bundle):
    approval, identities, _ = images.load_bundle(bundle)
    auth = authorize(bundle, approval)
    expected = json.loads((bundle / 'migrations.json').read_bytes())
    # Migration count must track each migration batch; keep in sync with
    # prepare_release_bundle.sh (bumped 78->79 with 0081_po_mrp_proposal_reference).
    images.require(hashlib.sha256((bundle / 'migrations.json').read_bytes()).hexdigest() == approval['migration_manifest_sha256'] and len(expected) == 79, 'Candidate migration manifest binding invalid')
    spec = importlib.util.spec_from_file_location('preflight', Path(__file__).with_name('production_preflight.py'))
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    # Handover state (apply-migrations -> recover): the registry already matches the
    # candidate manifest (FULLY_MATCHED) while the marker still names the previous
    # release, and the migration run left the API deliberately stopped. In exactly
    # that state the stopped-api window mode is allowed for preflight and the
    # baseline runtime probes are skipped: no application is supposed to be running,
    # and switch()'s own new-application probes remain the full gate. Known tradeoff:
    # if switch then fails, recover_previous_application restarts the OLD application
    # which now fails closed on the newer schema (one-way door, runbook section 6).
    rows = registry_snapshot()
    classification, pending = gate.classify_registry([{k:r[k] for k in ('name', 'checksum')} for r in rows], expected)
    marker = (ROOT / '.release-sha').read_text().strip()
    containers = json.loads(command(['docker', 'inspect', PROJECT+'-api-1', PROJECT+'-web-1']))
    # Ruling 9: the handover relaxation additionally requires the api container
    # to be actually stopped (not restarting); a running api with the same
    # registry shape is a plain application-only release and stays strict, so
    # the container health checks and baseline probes below keep running.
    api_state = containers[0]['State']
    api_stopped = not api_state.get('Running') and not api_state.get('Restarting')
    handover = handover_state(classification, marker, approval['release_sha'], api_stopped)
    gate.preflight(str(ROOT), expected, require_full=True, allow_stopped_api=handover)
    images.require(classification == 'FULLY_MATCHED' and not pending, 'Application-only release requires FULLY_MATCHED')
    # Host image evidence: same-candidate reruns stay byte-strict; a newer candidate
    # is accepted only with the runner's isolated FULLY_MATCHED + smoke-PASS proof.
    verify_image_evidence(ROOT, approval, identities, auth)
    for c in containers:
        command(['docker', 'image', 'inspect', c['Image']])
        if handover:
            images.require(c['Config']['Labels'].get('com.docker.compose.service') != 'api' or not c['State']['Running'], 'Handover state expects the api container to be stopped')
        else:
            images.require(c['State']['Running'] and c['State'].get('Health', {}).get('Status') == 'healthy', 'Current recovery container unavailable')
    if not handover:
        probe('http://127.0.0.1:4332', marker)
        # Baseline HTTPS must pass before API shutdown, including certificate validity.
        probe('https://erp.kingturf.cn', marker)
    return {'write_channels':verify_write_channels(), 'registry': rows, 'migration_state_hashes': state_hashes(), 'previous_sha': marker, 'recovery_images': [{'name':c['Name'],'id':c['Image'],'ref':c['Config']['Image']} for c in containers], **({'handover_state': True} if handover else {})}


def private_write(path, data):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as stream:
        stream.write(data)


def checkpoint(bundle, phase):
    atomic_json(bundle/'application-state.json',{'phase':phase,'at_utc':datetime.now(timezone.utc).isoformat(),'migration_execution':'NOT_INVOKED'})


def verify_write_channels():
    # Restrict observed runtime write access, not merely currently active queries.
    ids=command(['docker','ps','-aq','--filter','label=com.docker.compose.project='+PROJECT]).decode().split()
    project=json.loads(command(['docker','inspect',*ids]))
    by_service={c['Config']['Labels'].get('com.docker.compose.service'):c for c in project}
    images.require(len(project)==3 and set(by_service)=={'api','web','postgres'},'Unexpected production project writer inventory')
    pg=by_service['postgres']
    images.require(not pg['HostConfig'].get('PortBindings') and pg['HostConfig']['NetworkMode']!='host','Production database must not publish host ports')
    networks=list(pg['NetworkSettings']['Networks'])
    images.require(networks==[PROJECT+'_default'],'Unexpected production database network')
    network=json.loads(command(['docker','network','inspect',networks[0]]))[0]
    images.require(set(network.get('Containers',{}))<={c['Id'] for c in project},'Other container can access production database network')
    attachments=Path('/data/kingturf-erp-data/attachments')
    running=command(['docker','ps','-q']).decode().split()
    all_containers=json.loads(command(['docker','inspect',*running]))
    for c in all_containers:
        if c['Id']==by_service['api']['Id']:
            continue
        for mount in c['Mounts']:
            if mount['Type']=='bind' and mount.get('RW'):
                source=Path(mount['Source'])
                images.require(not (source==attachments or source in attachments.parents or attachments in source.parents),'Additional container can write approved attachments')
    return {'database_network':networks[0],'database_host_ports':False,'network_members':sorted(v['Name'] for v in network.get('Containers',{}).values()),'attachment_container_writer':'api_only','scope':'Docker runtime channels; privileged host operations remain coordinated by the authorized operator'}


def assert_drained():
    state=json.loads(command(['docker','inspect',PROJECT+'-api-1']))[0]['State']
    images.require(not state['Running'],'API shutdown fence absent')
    verify_write_channels()
    sql="BEGIN READ ONLY; SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'; COMMIT;"
    for sample in range(3):
        active=command(['docker','exec','-i',PROJECT+'-postgres-1','sh','-c','exec psql -X -qAt --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'],data=sql.encode())
        images.require(active.strip()==b'0','Database activity remained after API stop')
        if sample<2:
            time.sleep(1)


def recover_previous_application(bundle):
    before=verify_unchanged(bundle)
    overrides=json.loads((bundle/'recovery-compose.json').read_bytes())
    for service in ('api','web'):
        expected=next(i for i in before['recovery_images'] if i['name']=='/'+PROJECT+'-'+service+'-1')
        images.require(overrides['services'][service]['image']==expected['id'],'Recovery image identity mismatch')
        command(['docker','image','inspect',expected['id']])
    temporary=ROOT/'.env.production.recover-tmp'
    private_write(temporary,(bundle/'recovery-env').read_bytes())
    temporary.replace(ROOT/'.env.production')
    command(['docker','compose','--project-directory',str(ROOT),'--env-file',str(ROOT/'.env.production'),'-f',str(ROOT/'infra/docker/compose.production.yaml'),'-f',str(bundle/'recovery-compose.json'),'up','-d','--no-deps','--pull','never','api','web'])
    for attempt in range(45):
        try:
            for service in ('api','web'):
                c=json.loads(command(['docker','inspect',PROJECT+'-'+service+'-1']))[0]
                images.require(c['Image']==overrides['services'][service]['image'] and c['State']['Running'] and c['State'].get('Health',{}).get('Status')=='healthy','Previous application not yet healthy')
            probe('http://127.0.0.1:4332',before['previous_sha'])
            probe('https://erp.kingturf.cn',before['previous_sha'])
            verify_unchanged(bundle)
            checkpoint(bundle,'RECOVERED_PREVIOUS_APPLICATION')
            return
        except (RuntimeError,OSError):
            if attempt==44:
                raise
            time.sleep(2)


def backup(bundle):
    before = precheck(bundle)
    for identity in images.load_bundle(bundle)[1].values():
        images.check_image(identity)
    # Persist an application-only recovery recipe BEFORE stopping anything. It
    # contains private runtime environment, remains mode 0600 on this host only.
    containers = json.loads(command(['docker','inspect',PROJECT+'-api-1',PROJECT+'-web-1']))
    overrides = {'services': {c['Config']['Labels']['com.docker.compose.service']: {'image':c['Image'],'environment':dict(line.split('=',1) for line in c['Config']['Env'])} for c in containers}}
    private_write(bundle/'recovery-compose.json',json.dumps(overrides).encode())
    private_write(bundle/'recovery-env',(ROOT/'.env.production').read_bytes())
    atomic_json(bundle/'before.json',before)
    checkpoint(bundle,'STOPPING_API')
    compose('stop','-t','30','api')
    checkpoint(bundle,'API_STOPPED')
    assert_drained()
    verify_unchanged(bundle)
    directory = ROOT / '.release-backups'
    directory.mkdir(mode=0o700, exist_ok=True)
    prefix = directory / ('application-' + bundle.name)
    images.require(not prefix.with_suffix('.dump').exists(), 'Recovery point already exists; preserve it and use a new run')
    dump = command(['docker', 'exec', PROJECT+'-postgres-1', 'sh', '-c', 'exec pg_dump --format=custom --username="$POSTGRES_USER" "$POSTGRES_DB"'], timeout=180)
    images.require(bool(dump), 'Empty recovery dump')
    dump_path = prefix.with_suffix('.dump')
    fd = os.open(dump_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(dump)
    attach = prefix.with_suffix('.attachments.tar')
    with tarfile.open(attach, 'x') as archive:
        archive.add('/data/kingturf-erp-data/attachments', arcname='attachments')
    config = prefix.with_suffix('.config.tar')
    with tarfile.open(config, 'x') as archive:
        archive.add(ROOT / '.env.production', arcname='.env.production')
        archive.add(ROOT / 'infra/docker/compose.production.yaml', arcname='compose.production.yaml')
    os.chmod(attach, 0o600)
    os.chmod(config, 0o600)
    # Restore only into a disposable, network-isolated PostgreSQL container on tmpfs.
    scratch = 'kt-app-restore-' + bundle.name
    pg_image = json.loads(command(['docker', 'inspect', PROJECT+'-postgres-1']))[0]['Image']
    command(['docker', 'run', '-d', '--pull', 'never', '--network', 'none', '--name', scratch, '--label', 'kingturf.application-recovery=' + bundle.name, '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_USER=verify', '-e', 'POSTGRES_DB=verification', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', pg_image])
    try:
        for attempt in range(30):
            p = subprocess.run(['docker', 'exec', scratch, 'pg_isready', '-U', 'verify', '-d', 'verification'], capture_output=True)
            if p.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Isolated restore database did not start')
        command(['docker', 'exec', '-i', scratch, 'pg_restore', '--username=verify', '--dbname=verification', '--no-owner', '--no-acl', '--exit-on-error'], data=dump, timeout=180)
        restored = json.loads(command(['docker', 'exec', scratch, 'psql', '-X', '-qAt', '-U', 'verify', '-d', 'verification', '-c', REGISTRY_SQL]))
        images.require(restored == before['registry'], 'Isolated restore migration metadata differs')
    finally:
        command(['docker', 'rm', '-f', scratch])
    assert_drained()
    before['backup'] = {str(p.relative_to(ROOT)): {'sha256':images.checksum(p),'size':p.stat().st_size} for p in (dump_path,attach,config)}
    before['isolated_restore'] = 'PASS'
    atomic_json(bundle / 'before.json', before)
    return before


def verify_unchanged(bundle):
    before = json.loads((bundle / 'before.json').read_bytes())
    images.require(registry_snapshot() == before['registry'], 'Migration registry or original applied_at changed')
    images.require(state_hashes() == before['migration_state_hashes'], 'Historical migration execution state changed')
    for image in before['recovery_images']:
        command(['docker', 'image', 'inspect', image['id']])
    return before


def switch(bundle):
    approval, identities, _ = images.load_bundle(bundle)
    authorize(bundle, approval)
    for i in identities.values():
        images.check_image(i)
    before = verify_unchanged(bundle)
    images.require(before['isolated_restore'] == 'PASS', 'Restore verification missing')
    for path, evidence in before['backup'].items():
        images.require(images.checksum(ROOT/path) == evidence['sha256'], 'Recovery file checksum changed')
    assert_drained()
    checkpoint(bundle,'SWITCHING_APPLICATION')
    env_path = ROOT / '.env.production'
    lines = env_path.read_text().splitlines()
    replacements = {f'KINGTURF_{s.upper()}_IMAGE':i['local_ref'].split('@')[0] for s,i in identities.items()}
    replacements.update({f'KINGTURF_{s.upper()}_DIGEST':i['approved_digest'] for s,i in identities.items()})
    replacements.update(KINGTURF_RELEASE_SHA=approval['release_sha'], KINGTURF_RELEASE_BUILT_AT='application-' + bundle.name, KINGTURF_WRITE_FENCE='disabled')
    lines = [line for line in lines if line.split('=',1)[0] not in replacements]
    temporary = env_path.with_suffix('.production.app-tmp')
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write('\n'.join(lines + [k+'='+v for k,v in replacements.items()]) + '\n')
    temporary.replace(env_path)
    env = os.environ.copy()
    env.update(replacements)
    # No postgres recreation, build, registry access, DDL or automatic retry.
    compose('up', '-d', '--no-deps', '--pull', 'never', 'api', 'web', env=env)
    for attempt in range(45):
        try:
            runtime = images.verify_runtime(bundle)
            probe('http://127.0.0.1:4332', approval['release_sha'])
            break
        except (RuntimeError, OSError):
            if attempt == 44:
                raise
            time.sleep(2)
    probe('https://erp.kingturf.cn', approval['release_sha'])
    verify_unchanged(bundle)
    atomic_json(bundle/'runtime.json', runtime)
    # Marker only changes after runtime identity, internal/public probes and no DDL.
    temporary_marker = ROOT / ('.release-sha.' + bundle.name + '.tmp')
    temporary_marker.write_text(approval['release_sha'])
    temporary_marker.replace(ROOT / '.release-sha')
    checkpoint(bundle,'DEPLOYED')
    # Every successful application-only release advances the in-file compatibility
    # record; the next precheck rerun of this candidate stays byte-strict.
    advance_image_evidence(ROOT, bundle, approval, identities)
    return {'deployment':'PASS','sha':approval['release_sha'],'migration_registry':'FULLY_MATCHED','migration_execution':'NOT_INVOKED','recovery_images':'RETAINED','images':runtime['images']}


def main():
    # Existing backup roots may be 0755: archives must be private from creation,
    # before any payload is written, rather than only chmod'ed after completion.
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('precheck','backup','switch','postcheck'))
    parser.add_argument('bundle', type=Path)
    args=parser.parse_args()
    images.require(args.bundle.resolve().parent == ROOT / '.release-image-recovery' and re.fullmatch(r'[0-9]+-[0-9]+',args.bundle.name), 'Unexpected recovery work directory')
    try:
        if args.action=='precheck': result=precheck(args.bundle)
        elif args.action=='backup': result=backup(args.bundle)
        elif args.action=='switch': result=switch(args.bundle)
        else:
            verify_unchanged(args.bundle)
            result=images.verify_runtime(args.bundle)
    except Exception as failure:
        # Ruling 11 diagnosis: the wrapper must not swallow the original failure —
        # keep the chain (traceback prints both) and echo the repr to stderr so
        # the Actions log carries the exact inner error without host access.
        print(f'inner failure: {failure!r}', file=sys.stderr)
        state=args.bundle/'application-state.json'
        if state.exists() and json.loads(state.read_bytes())['phase'] in ('STOPPING_API','API_STOPPED','SWITCHING_APPLICATION'):
            try:
                recover_previous_application(args.bundle)
            except Exception as recovery_failure:
                checkpoint(args.bundle,'RECOVERY_FAILED')
                print(f'recovery failure: {recovery_failure!r}', file=sys.stderr)
                raise RuntimeError('Application recovery failed; inspect retained private host evidence') from recovery_failure
        raise RuntimeError('Application release stopped; previous application recovery attempted where required; inspect application-state.json') from failure
    print(json.dumps(result,sort_keys=True))


if __name__=='__main__':
    main()
