#!/usr/bin/env python3
"""TD-REL-011: stage selected recovery evidence before apply, inside the existing lock.

The first SSH operation follows complete local validation. Remote Python verifies
all transferred bytes and private paths before executing any transferred helper.
Installation activates the root descriptor first, then the ordinary root approval
last. Existing version directories and archived approvals are never deleted.
This helper has no fence, application, database, or migration-execution operation.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import sys
import tempfile

sys.dont_write_bytecode = True

_SPEC = importlib.util.spec_from_file_location('fixed_recovery_transport', Path(__file__).with_name('recovery_material_transport.py'))
transport = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(transport)
require = transport.require

# This literal is sent by fixed control C, not imported from transferred material.
# It checks the complete byte inventory before exec of the transferred installer.
BOOTSTRAP = r'''
import hashlib,json,os,pathlib,stat,sys
mode,root,expected=sys.argv[1:]
p=pathlib.Path(root)
for ancestor in [p,*p.parents]:
 if ancestor.is_symlink(): raise RuntimeError('symlink in private transfer path')
if mode=='create':
 parent=p.parent
 assert parent.is_dir() and parent.stat().st_uid==os.geteuid() and stat.S_IMODE(parent.stat().st_mode)==0o700
 assert not p.exists()
 p.mkdir(mode=0o700)
else:
 assert p.is_dir() and p.stat().st_uid==os.geteuid() and stat.S_IMODE(p.stat().st_mode)==0o700
 manifest=p/'transfer.json'
 assert manifest.is_file() and not manifest.is_symlink() and stat.S_IMODE(manifest.stat().st_mode)==0o600
 assert hashlib.sha256(manifest.read_bytes()).hexdigest()==expected
 data=json.loads(manifest.read_bytes())
 seen=set()
 for f in p.rglob('*'):
  assert not f.is_symlink() and f.stat().st_uid==os.geteuid()
  assert stat.S_IMODE(f.stat().st_mode)==(0o700 if f.is_dir() else 0o600)
  if f.is_file():
   name=f.relative_to(p).as_posix(); seen.add(name)
   if name!='transfer.json':
    with f.open('rb') as stream: actual=hashlib.file_digest(stream,'sha256').hexdigest()
    assert data['files'].get(name)==actual
  else: assert f.is_dir()
 assert seen==set(data['files'])|{'transfer.json'}
'''


def private_tree(root):
    root = Path(root)
    for path in [root, *root.rglob('*')]:
        require(not path.is_symlink() and path.stat().st_uid == os.geteuid(), 'transfer path owner/symlink differs')
        require(path.is_dir() or path.is_file(), 'special transfer file')
        require(stat.S_IMODE(path.stat().st_mode) == (0o700 if path.is_dir() else 0o600), 'private transfer permissions differ')


def validate_payload(root, expected, candidate, control_sha):
    root = Path(root)
    private_tree(root)
    manifest = transport.ordinary(root, 'transfer.json')
    require(transport.digest(manifest) == expected, 'transfer inventory raw hash differs')
    data = transport.json_file(root, 'transfer.json')
    require(data.get('kind') == 'compatible_recovery_stage_v1' and data.get('candidate_sha') == candidate and data.get('control_sha') == control_sha, 'transfer control/candidate identity differs')
    require(isinstance(data.get('run'), str) and re.fullmatch(r'[1-9][0-9]*-[1-9][0-9]*', data['run']), 'transfer run identity malformed')
    actual = transport.file_inventory(root)
    del actual['transfer.json']
    require(actual == data.get('files'), 'transfer bytes or file set differs')
    scripts = {name for name in actual if name.startswith('scripts/')}
    require(scripts == {'scripts/'+name for name in transport.CONTROL_FILES}, 'fixed control dependencies missing or unexpected')
    for name in transport.CONTROL_FILES:
        require(actual['scripts/'+name] == data.get('controls', {}).get(name), 'control bytes differ from C inventory')
    plan = transport.json_file(root, 'plan.json')
    require(plan.get('release_sha') == candidate, 'deployment plan selects another B')
    transport.validate_material(root, root/'material', root/'plan.json')
    return data


def atomic_file(root, name, raw, nonce):
    path = root/('.'+name+'.'+nonce)
    with path.open('xb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(path, root/name)
    directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def install_material(incoming, canonical, expected, candidate, control_sha):
    incoming, canonical = Path(incoming).absolute(), Path(canonical).absolute()
    require(transport.SHA.fullmatch(candidate) and transport.SHA.fullmatch(control_sha), 'install SHA malformed')
    data = validate_payload(incoming, expected, candidate, control_sha)
    require(canonical.name == '.release-migration-evidence', 'canonical evidence root required')
    for parent in [canonical, *canonical.parents]:
        require(not parent.is_symlink(), 'symlink in canonical path')
    if canonical.exists():
        require(canonical.is_dir() and canonical.stat().st_uid == os.geteuid() and not canonical.stat().st_mode & 0o022, 'canonical directory owner/permissions differ')
    else:
        canonical.mkdir(mode=0o700)
    material = incoming/'material'
    descriptor = transport.json_file(material, 'compatible_recovery.json')
    approval = transport.ordinary(material, 'migration-recovery-approval.json').read_bytes()
    # Root metadata and per-run plans are not version assets. Approval renewals can
    # activate the same immutable B assets without overwriting their old bytes.
    exclude = {'migration-recovery-approval.json', 'compatible_recovery.json', 'validation-plan.json'}
    assets = {name: value for name, value in transport.file_inventory(material).items() if name not in exclude}
    version = canonical/candidate
    if version.exists():
        private_tree(version)
        require(not version.is_symlink() and transport.file_inventory(version) == assets, 'existing B material is immutable and differs')
    else:
        staged = canonical/('.install-'+data['run'])
        require(not staged.exists(), 'run install directory already exists')
        staged.mkdir(mode=0o700)
        for name in assets:
            source = transport.ordinary(material, name)
            destination = staged/name
            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.copyfile(source, destination)
            destination.chmod(0o600)
        private_tree(staged)
        require(transport.file_inventory(staged) == assets, 'installed bytes differ before activation')
        os.replace(staged, version)
    # Keep every prior root approval/descriptor, including manually provisioned
    # legacy material, before activating the next ordinary canonical files.
    archive = canonical/'archive'
    require(not archive.is_symlink(), 'archive symlink forbidden')
    archive.mkdir(exist_ok=True, mode=0o700)
    require(archive.is_dir() and archive.stat().st_uid == os.geteuid() and stat.S_IMODE(archive.stat().st_mode) == 0o700, 'archive owner/permissions differ')
    prior = archive/('material-'+data['run'])
    require(not prior.exists(), 'run approval archive already exists')
    prior.mkdir(mode=0o700)
    for name in ('migration-recovery-approval.json', 'compatible_recovery.json'):
        previous = transport.ordinary(canonical, name, missing=True)
        if previous is not None:
            shutil.copyfile(previous, prior/name)
            (prior/name).chmod(0o600)
    activated = dict(descriptor)
    for name in ('recovery_bundle_file', 'source_bundle_file', 'report_file'):
        activated[name] = candidate+'/'+str(transport.relative_name(descriptor[name]))
    atomic_file(canonical, 'compatible_recovery.json', json.dumps(activated, sort_keys=True).encode(), data['run'])
    binding = transport.json_file(material, 'migration-recovery-approval.json')['compatible_recovery']
    transport.command([sys.executable, '-I', '-B', str(incoming/'scripts/release_orchestrator.py'), 'check-compatible-recovery', str(incoming/'plan.json'), str(material/'migration-recovery-approval.json'), str(canonical), binding['legacy_business_sha']])
    # The last atomic replace is the activation point. On interruption, a prior
    # approval and new descriptor cannot validate as a matching authorized pair.
    atomic_file(canonical, 'migration-recovery-approval.json', approval, data['run'])
    return {'status': 'PASS', 'candidate_sha': candidate, 'control_sha': control_sha, 'live_fence_verified': False}


def ssh_settings(environ):
    host, user, port = (environ.get(name, '') for name in ('PROD_SSH_HOST', 'PROD_SSH_USER', 'PROD_SSH_PORT'))
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.:-]*', host) and re.fullmatch(r'[a-z_][a-z0-9_-]*', user), 'SSH identity malformed')
    require(port.isdigit() and 0 < int(port) < 65536, 'SSH port malformed')
    known = Path(environ.get('SSH_KNOWN_HOSTS_FILE', ''))
    require(known.is_file() and not known.is_symlink(), 'pinned known_hosts ordinary file required')
    require(environ.get('PROD_DEPLOY_PATH') == '/data/kingturf-erp', 'production root differs')
    flags = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile='+str(known), '-o', 'KexAlgorithms=curve25519-sha256', '-p', port]
    return ['ssh', *flags], user+'@'+host


def stage_material(control, control_sha, bundle, plan, candidate, environ=None):
    environ = os.environ if environ is None else environ
    control, bundle, plan = Path(control).absolute(), Path(bundle).absolute(), Path(plan).absolute()
    material = bundle/'compatible-recovery'
    # Only the immutable C selection chooses mode; presence of files cannot.
    transport.control_identity(control, control_sha)
    selected = transport.approved_selection(control, candidate, control_sha)
    if selected is None:
        require(not material.exists() and not material.is_symlink(), 'unselected compatible material in application bundle')
        return {'mode': 'legacy', 'host_writes': False}
    require(material.is_dir() and not material.is_symlink(), 'selected compatible material is missing or redirected')
    require(candidate != control_sha, 'approval C must be later than B')
    transport.git(control, 'merge-base', '--is-ancestor', candidate, control_sha)
    # Read the actual deployment plan once. Validation applies to the final
    # private copy, never to a mutable source that will be copied afterwards.
    raw_plan = transport.ordinary(plan.parent, plan.name).read_bytes()
    with tempfile.TemporaryDirectory(prefix='recovery-stage-') as temp:
        payload = Path(temp)/'payload'
        payload.mkdir(mode=0o700)
        shutil.copytree(material, payload/'material', symlinks=True)
        transport.file_inventory(payload/'material')
        for path in (payload/'material').rglob('*'):
            path.chmod(0o700 if path.is_dir() else 0o600)
        (payload/'material').chmod(0o700)
        (payload/'plan.json').write_bytes(raw_plan)
        (payload/'plan.json').chmod(0o600)
        controls = transport.snapshot_controls(control, control_sha, payload)
        prefix = selected[0].relative_to(control).as_posix()+'/'
        snapshot = payload/'material'
        descriptor = transport.json_file(snapshot, 'compatible_recovery.json')
        mapping = {'approval.json': 'migration-recovery-approval.json', 'compatible_recovery.json': 'compatible_recovery.json', 'transport-source.json': 'transport-source.json', str(transport.relative_name(descriptor.get('report_file'))): descriptor.get('report_file')}
        require(len(mapping) == 4, 'C selection paths collide')
        for original, copied in mapping.items():
            expected_raw = transport.git(control, 'show', control_sha+':'+prefix+original)
            require(transport.ordinary(snapshot, copied).read_bytes() == expected_raw, 'private snapshot selection differs from fixed C Git object: '+original)
        require(transport.json_file(payload, 'plan.json').get('release_sha') == candidate, 'live deployment plan differs from B')
        approval = transport.validate_material(payload, snapshot, payload/'plan.json')
        transport.git(control, 'merge-base', '--is-ancestor', approval['compatible_recovery']['recovery_main_sha'], 'refs/remotes/origin/main')
        ssh, host = ssh_settings(environ)
        run_id, attempt = environ.get('GITHUB_RUN_ID', ''), environ.get('GITHUB_RUN_ATTEMPT', '')
        require(re.fullmatch(r'[1-9][0-9]*', run_id) and re.fullmatch(r'[1-9][0-9]*', attempt), 'unique run identity required')
        nonce = run_id+'-'+attempt
        staged = '/data/kingturf-erp/.staging/wave2-'+nonce
        remote = staged+'/compatible-recovery-'+nonce
        canonical = '/data/kingturf-erp/.release-migration-evidence'
        manifest = {'kind': 'compatible_recovery_stage_v1', 'candidate_sha': candidate,
                    'control_sha': control_sha, 'run': nonce, 'controls': controls,
                    'files': transport.file_inventory(payload)}
        transport.write_json(payload/'transfer.json', manifest)
        private_tree(payload)
        expected = transport.digest(payload/'transfer.json')
        # Existing migration stage must already contain the original three files.
        checks = '; '.join('test "$(sha256sum '+shlex.quote(staged+'/'+name)+' | cut -d " " -f1)" = '+shlex.quote(controls[name]) for name in ('apply_migrations.py', 'release_orchestrator.py', 'production_preflight.py'))
        create = shlex.join(['python3', '-I', '-c', BOOTSTRAP, 'create', remote, expected])
        transport.command([*ssh, host, 'set -eu; '+checks+'; '+create])
        transport.command(['rsync', '-az', '--partial', '--no-owner', '--no-group', '-e', shlex.join(ssh), str(payload)+'/', host+':'+remote+'/'])
        verify = shlex.join(['python3', '-I', '-c', BOOTSTRAP, 'verify', remote, expected])
        install = shlex.join(['python3', '-I', '-B', remote+'/scripts/stage_recovery_material.py', 'install', '--incoming', remote, '--canonical-root', canonical, '--transfer-sha256', expected, '--candidate-sha', candidate, '--control-sha', control_sha])
        transport.command([*ssh, host, 'set -eu; '+verify+'; '+install])
    return {'mode': 'compatible_recovery', 'candidate_sha': candidate, 'control_sha': control_sha, 'remote': remote}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('stage', 'install'))
    parser.add_argument('--control-root', type=Path)
    parser.add_argument('--control-sha', required=True)
    parser.add_argument('--candidate-sha', required=True)
    parser.add_argument('--bundle', type=Path)
    parser.add_argument('--plan', type=Path)
    parser.add_argument('--incoming', type=Path)
    parser.add_argument('--canonical-root', type=Path)
    parser.add_argument('--transfer-sha256')
    args = parser.parse_args()
    try:
        if args.action == 'stage':
            result = stage_material(args.control_root, args.control_sha, args.bundle, args.plan, args.candidate_sha)
        else:
            result = install_material(args.incoming, args.canonical_root, args.transfer_sha256, args.candidate_sha, args.control_sha)
        print(json.dumps(result, sort_keys=True))
    except (RuntimeError, ValueError, OSError, KeyError, TypeError) as error:
        print('GATE_FAILED:recovery_transport: '+str(error), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
