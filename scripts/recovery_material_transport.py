#!/usr/bin/env python3
"""TD-REL-011: fixed-control export/prepare of original recovery material.

C selects release-materials/compatible-recovery/<B>/approval.json explicitly.
Its transport_source_sha256 binds the ordinary transport-source.json bytes.
The latter's exact schema is SOURCE_KEYS below. C is established by checkout,
never by a self-referencing field in approval.json. export_control_sha refers
only to the earlier immutable workflow that generated the approved artifact.
Core approval/report/Git-history checks belong to release_orchestrator's
check-compatible-recovery CLI; this module adds transport provenance checks.
No action imports images, starts services, changes a fence, or runs migrations.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import zipfile

sys.dont_write_bytecode = True

REPOSITORY = 'ivanzhao299/kingturf-bessiness-os'
WORKFLOW = '.github/workflows/release-images.yml'
SHA = re.compile(r'[0-9a-f]{40}')
HASH = re.compile(r'[0-9a-f]{64}')
DIGEST = re.compile(r'sha256:[0-9a-f]{64}')
SQL = re.compile(r'[0-9]{4}_[a-z0-9_]+\.sql')
ARTIFACT_FILES = {'recovery.tar.gz', 'source.bundle', 'provenance.json', 'migrations.json', 'release.json'}
SOURCE_KEYS = {'kind', 'repository', 'workflow', 'event', 'run_id', 'run_attempt', 'artifact_id', 'artifact_name', 'export_control_sha', 'provenance_sha256', 'source_bundle_sha256', 'artifact_sha256'}
CONTROL_FILES = ('recovery_material_transport.py', 'stage_recovery_material.py', 'release_orchestrator.py', 'production_preflight.py', 'oci_image_transport.py', 'apply_migrations.py')


def require(ok, message):
    if not ok:
        raise RuntimeError('GATE_FAILED:recovery_transport: ' + message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def canonical(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def relative_name(value):
    require(isinstance(value, str) and value and '\\' not in value and '\x00' not in value,
            'ordinary relative path required')
    parts = PurePosixPath(value)
    require(not parts.is_absolute() and all(p not in ('', '.', '..') for p in value.split('/')),
            'path must remain inside its material root')
    return parts


def ordinary(root, name, *, missing=False):
    base = Path(root)
    require(base.is_dir() and not base.is_symlink(), 'material root must be an ordinary directory')
    current = base
    parts = relative_name(name).parts
    for index, part in enumerate(parts):
        current = current / part
        require(not current.is_symlink(), 'symlink in material path')
        if not current.exists():
            require(missing, 'material file missing: ' + name)
            return None
        mode = current.stat().st_mode
        require(stat.S_ISDIR(mode) if index < len(parts)-1 else stat.S_ISREG(mode),
                'material path is not an ordinary file')
    return current


def json_file(root, name):
    path = ordinary(root, name)
    require(path.stat().st_size <= 2 * 1024**2, 'JSON material exceeds size limit')
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate JSON key')
            result[key] = value
        return result
    value = json.loads(path.read_bytes(), object_pairs_hook=pairs)
    require(isinstance(value, dict), 'JSON material must be an object')
    return value


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open('xb') as stream:
        stream.write(json.dumps(value, sort_keys=True).encode())
    path.chmod(0o600)


def command(argv, *, cwd=None, output=None, env=None):
    # Captured stderr may contain credential-bearing tool diagnostics: do not echo it.
    with (Path(output).open('xb') if output else tempfile.TemporaryFile()) as stream:
        result = subprocess.run(argv, cwd=cwd, env=env, stdout=stream, stderr=subprocess.PIPE, timeout=1800)
        require(result.returncode == 0, 'required command failed: ' + Path(argv[0]).name)
        if output:
            Path(output).chmod(0o600)
            return b''
        stream.seek(0)
        return stream.read()


def git(root, *args):
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT='0')
    return command(['git', '-c', 'core.hooksPath='+os.devnull, '-c', 'protocol.file.allow=always', '-C', str(root), *args], env=env)


def control_identity(root, expected):
    require(isinstance(expected, str) and SHA.fullmatch(expected), 'fixed control SHA malformed')
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == expected, 'checkout differs from fixed control SHA')
    git(root, 'merge-base', '--is-ancestor', expected, 'refs/remotes/origin/main')
    for name in CONTROL_FILES:
        file = ordinary(root, 'scripts/'+name)
        require(file.read_bytes() == git(root, 'show', expected+':scripts/'+name), 'control file differs from fixed commit')


def snapshot_controls(control, control_sha, target):
    scripts = Path(target)/'scripts'
    scripts.mkdir(parents=True, exist_ok=True, mode=0o700)
    hashes = {}
    for name in CONTROL_FILES:
        raw = git(control, 'show', control_sha+':scripts/'+name)
        with (scripts/name).open('xb') as stream:
            stream.write(raw)
        (scripts/name).chmod(0o600)
        hashes[name] = hashlib.sha256(raw).hexdigest()
    return hashes


def tree_manifest(root, sha):
    prefix = 'packages/database/migrations/'
    names = git(root, 'ls-tree', '-r', '--name-only', sha, '--', prefix).decode().splitlines()
    files = [name for name in names if name.endswith('.sql')]
    require(len(files) == 81 and all(SQL.fullmatch(name.removeprefix(prefix)) for name in files),
            'recovery requires the complete 81-SQL manifest')
    return {name.removeprefix(prefix): hashlib.sha256(git(root, 'show', sha+':'+name)).hexdigest() for name in files}


def module(root, name):
    path = ordinary(root, 'scripts/'+name+'.py')
    spec = importlib.util.spec_from_file_location('fixed_'+name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def safe_archive(path, target, *, zipped=False):
    """Extract data to a new directory; no symlinks, hardlinks, duplicates or escapes."""
    target = Path(target)
    require(not target.exists(), 'extraction directory already exists')
    target.mkdir(mode=0o700)
    archive = zipfile.ZipFile(path) if zipped else tarfile.open(path, 'r:*')
    seen, total = set(), 0
    with archive:
        entries = archive.infolist() if zipped else archive.getmembers()
        require(len(entries) < 10000, 'archive has too many entries')
        for item in entries:
            name = item.filename if zipped else item.name
            is_dir = item.is_dir() if zipped else item.isdir()
            if is_dir:
                name = name.rstrip('/')
            relative_name(name)
            require(name not in seen, 'duplicate archive path')
            seen.add(name)
            if zipped:
                mode = item.external_attr >> 16
                require(not mode or stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR), 'archive link/device forbidden')
                size = item.file_size
            else:
                require(item.isfile() or item.isdir(), 'archive link/device forbidden')
                size = item.size
            total += size
            require(total < 64 * 1024**3, 'archive exceeds byte limit')
            destination = target / name
            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            require(not destination.exists(), 'archive file/directory collision')
            if is_dir:
                destination.mkdir(mode=0o700)
            else:
                with (archive.open(item) if zipped else archive.extractfile(item)) as source, destination.open('xb') as stream:
                    shutil.copyfileobj(source, stream)
                destination.chmod(0o600)


def file_inventory(root):
    root = Path(root)
    result = {}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), 'symlink in material tree')
        require(path.is_file() or path.is_dir(), 'special file in material tree')
        if path.is_file():
            name = path.relative_to(root).as_posix()
            ordinary(root, name)
            result[name] = digest(path)
    return result


def check_oci(control, directory, release_sha, manifest, bindings):
    actual = json_file(directory, 'migrations.json')
    release = json_file(directory, 'release.json')
    require(actual == manifest, 'R manifest differs from target/source')
    require(release.get('release_sha') == release_sha, 'R release identity differs')
    require(release.get('migration_manifest_sha256') == digest(ordinary(directory, 'migrations.json')), 'raw migrations.json hash differs')
    transport = module(control, 'oci_image_transport')
    _, identities, _ = transport.load_bundle(directory)
    for service in ('api', 'web'):
        require(identities[service]['approved_digest'] == bindings[service+'_digest'], 'R root image digest differs')
    return identities


def export_material(source, control, control_sha, release_sha, api_digest, web_digest, out):
    control, source, out = Path(control).absolute(), Path(source).absolute(), Path(out).absolute()
    require(os.environ.get('GITHUB_REPOSITORY') == REPOSITORY and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch' and os.environ.get('GITHUB_REF') == 'refs/heads/main', 'untrusted export workflow context')
    require(all(re.fullmatch(r'[1-9][0-9]*', os.environ.get(name, '')) for name in ('GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT')), 'export run identity malformed')
    control_identity(control, control_sha)
    require(SHA.fullmatch(release_sha) and DIGEST.fullmatch(api_digest) and DIGEST.fullmatch(web_digest), 'export identities malformed')
    require(git(source, 'rev-parse', 'HEAD').decode().strip() == release_sha, 'source checkout differs from R')
    main = git(control, 'rev-parse', 'refs/remotes/origin/main').decode().strip()
    git(control, 'merge-base', '--is-ancestor', release_sha, main)
    manifest = tree_manifest(control, release_sha)
    for name, expected in manifest.items():
        require(digest(ordinary(source, 'packages/database/migrations/'+name)) == expected, 'source checkout SQL differs from R tree')
    require(not out.exists(), 'export output must be a new directory')
    out.mkdir(parents=True, mode=0o700)
    prepare = ordinary(control, 'scripts/prepare_release_bundle.sh')
    prepare_raw = git(control, 'show', control_sha+':scripts/prepare_release_bundle.sh')
    require(prepare.read_bytes() == prepare_raw, 'export script is not fixed control')
    with tempfile.TemporaryDirectory(prefix='recovery-export-') as temp:
        fixed_control = Path(temp)/'control'
        snapshot_controls(control, control_sha, fixed_control)
        prepare = fixed_control/'scripts/prepare_release_bundle.sh'
        prepare.write_bytes(prepare_raw)
        prepare.chmod(0o600)
        # The fixed prepare script uses stdin Python and relative SQL paths.
        # Give it only immutable R SQL data in a fresh private cwd: an R checkout
        # may contain json.py or other code that ordinary Python would import.
        sql_root = Path(temp)/'source'
        sql_dir = sql_root/'packages/database/migrations'
        sql_dir.mkdir(parents=True, mode=0o700)
        for name, expected in manifest.items():
            raw = git(control, 'show', release_sha+':packages/database/migrations/'+name)
            require(hashlib.sha256(raw).hexdigest() == expected, 'R Git SQL snapshot differs')
            with (sql_dir/name).open('xb') as stream:
                stream.write(raw)
            (sql_dir/name).chmod(0o600)
        layout = Path(temp)/'oci'
        command(['bash', str(prepare), release_sha, api_digest, web_digest, str(layout)], cwd=sql_root)
        inventory = file_inventory(layout)
        require(all(name in ('release.json', 'migrations.json', 'api-tag.json', 'web-tag.json', 'api/index.json', 'api/oci-layout', 'web/index.json', 'web/oci-layout') or re.fullmatch(r'(api|web)/blobs/sha256/[0-9a-f]{64}', name) for name in inventory), 'unexpected configuration or credential file in OCI export')
        check_oci(fixed_control, layout, release_sha, manifest, {'api_digest': api_digest, 'web_digest': web_digest})
        # This tar is created exactly once. Every later consumer receives these bytes.
        with tarfile.open(out/'recovery.tar.gz', 'w:gz', dereference=False) as archive:
            for name in inventory:
                archive.add(layout/name, arcname=name, recursive=False)
        (out/'recovery.tar.gz').chmod(0o600)
        for name in ('release.json', 'migrations.json'):
            shutil.copyfile(layout/name, out/name)
            (out/name).chmod(0o600)
        bare = Path(temp)/'git'
        bare.mkdir()
        git(bare, 'init', '--bare', '--quiet')
        git(bare, 'fetch', '--quiet', '--no-tags', str(control), main+':refs/heads/main', release_sha+':refs/heads/recovery')
        git(bare, 'bundle', 'create', str(out/'source.bundle'), 'refs/heads/main', 'refs/heads/recovery')
        refs = git(bare, 'bundle', 'list-heads', str(out/'source.bundle')).decode().splitlines()
        require(set(refs) == {main+' refs/heads/main', release_sha+' refs/heads/recovery'}, 'source bundle must contain the two exact refs')
        (out/'source.bundle').chmod(0o600)
    provenance = {
        'kind': 'compatible_recovery_export_v1', 'repository': os.environ.get('GITHUB_REPOSITORY'),
        'workflow': WORKFLOW, 'event': os.environ.get('GITHUB_EVENT_NAME'),
        'control_sha': control_sha, 'release_sha': release_sha, 'main_sha': main,
        'run_id': int(os.environ['GITHUB_RUN_ID']), 'run_attempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'api_digest': api_digest, 'web_digest': web_digest,
        'target_manifest_sha256': canonical(manifest),
        'files': {name: digest(out/name) for name in sorted(ARTIFACT_FILES-{'provenance.json'})},
    }
    require(provenance['repository'] == REPOSITORY and provenance['event'] == 'workflow_dispatch', 'untrusted export workflow context')
    write_json(out/'provenance.json', provenance)
    return {'artifact_name': 'compatible-recovery-material-'+release_sha, 'release_sha': release_sha, 'main_sha': main, 'files': file_inventory(out)}


def pinned_file(control, path, control_sha='HEAD'):
    path = Path(path)
    name = path.relative_to(control).as_posix()
    raw = git(control, 'show', control_sha+':'+name)
    require(ordinary(control, name).read_bytes() == raw, 'selection bytes differ from fixed control C')
    return raw


def approved_selection(control, candidate, control_sha='HEAD'):
    control = Path(control)
    require(isinstance(candidate, str) and SHA.fullmatch(candidate), 'candidate SHA malformed')
    name = 'release-materials/compatible-recovery/'+candidate+'/approval.json'
    selected = ordinary(control, name, missing=True)
    if selected is None:
        require(not git(control, 'ls-tree', control_sha, '--', name), 'C selects material but its approval is missing')
        return None
    raw = pinned_file(control, selected, control_sha)
    base = selected.parent
    json_file(base, 'approval.json')  # Reject duplicate keys as well as malformed JSON.
    approval = json.loads(raw)
    require(approval.get('image_compatibility_mode') == 'compatible_recovery', 'existing selection must explicitly approve compatible_recovery')
    require(approval.get('release_sha') == candidate, 'approval selects another business candidate')
    return base, approval


def gh_json(endpoint):
    return json.loads(command(['gh', 'api', endpoint]))


def check_source(selection, approval):
    source = json_file(selection, 'transport-source.json')
    require(set(source) == SOURCE_KEYS and source.get('kind') == 'compatible_recovery_transport_source_v1', 'transport-source schema differs')
    require(approval.get('transport_source_sha256') == digest(ordinary(selection, 'transport-source.json')), 'transport-source bytes are not bound by approval')
    require(source['repository'] == REPOSITORY and source['workflow'] == WORKFLOW and source['event'] == 'workflow_dispatch', 'unapproved artifact source')
    require(all(type(source[key]) is int and source[key] > 0 for key in ('run_id', 'run_attempt', 'artifact_id')), 'artifact run identities malformed')
    require(SHA.fullmatch(source['export_control_sha']) is not None, 'export control SHA malformed')
    require(all(isinstance(source[key], str) and HASH.fullmatch(source[key]) for key in ('provenance_sha256', 'source_bundle_sha256', 'artifact_sha256')), 'transport hashes malformed')
    recovery = approval.get('compatible_recovery', {})
    require(source['artifact_name'] == 'compatible-recovery-material-'+str(recovery.get('recovery_release_sha')), 'artifact name selects another R')
    return source


def publication_metadata(source, run, artifact):
    require(isinstance(run, dict) and isinstance(artifact, dict), 'publication metadata must be objects')
    require(run.get('id') == source['run_id'], 'run identity differs')
    require(run.get('repository', {}).get('full_name') == REPOSITORY and run.get('head_repository', {}).get('full_name') == REPOSITORY, 'run repository differs')
    require(run.get('path') == WORKFLOW and run.get('event') == 'workflow_dispatch' and run.get('head_branch') == 'main', 'run workflow/event/ref differs')
    require(run.get('status') == 'completed' and run.get('conclusion') == 'success', 'approved image run is not successful')
    # head_sha is the export workflow control, NEVER inputs.commit_sha (R).
    require(run.get('head_sha') == source['export_control_sha'] and run.get('run_attempt') == source['run_attempt'], 'run control/attempt differs')
    require(artifact.get('id') == source['artifact_id'] and artifact.get('name') == source['artifact_name'] and artifact.get('expired') is False, 'artifact identity missing, wrong or expired')
    require(artifact.get('workflow_run', {}).get('id') == source['run_id'], 'artifact belongs to another run')
    require(artifact.get('digest') == 'sha256:'+source['artifact_sha256'], 'approved artifact archive hash differs')


def download_approved(source, target):
    repo = 'repos/'+REPOSITORY+'/actions/'
    run = gh_json(repo+'runs/'+str(source['run_id']))
    artifact = gh_json(repo+'artifacts/'+str(source['artifact_id']))
    publication_metadata(source, run, artifact)
    target = Path(target)
    command(['gh', 'api', repo+'artifacts/'+str(source['artifact_id'])+'/zip'], output=target)
    require(digest(target) == source['artifact_sha256'], 'downloaded artifact bytes differ')
    return run, artifact


def transport_plan(control, candidate_root, candidate, approval, out, *, fixed_control=None):
    orchestrator = module(fixed_control or control, 'release_orchestrator')
    manifest = orchestrator.read_manifest(Path(candidate_root)/'packages/database/migrations')
    require(len(manifest) == 81 and manifest == tree_manifest(control, candidate), 'target manifest must equal all 81 B Git SQL files')
    suffix = approval.get('approved_suffix')
    require(isinstance(suffix, list) and suffix and sorted(suffix) == sorted(manifest)[-len(suffix):], 'approved migrations must be the exact target suffix')
    registry = [{'name': name, 'checksum': value} for name, value in sorted(manifest.items()) if name not in suffix]
    # This is a local material validation plan, not a live production registry claim.
    plan = orchestrator.build_plan(Path(candidate_root)/'packages/database/migrations', candidate, registry)
    write_json(out, plan)
    return plan


def validate_material(control, root, plan_file):
    root = Path(root)
    approval = json_file(root, 'migration-recovery-approval.json')
    source = check_source(root, approval)
    descriptor = json_file(root, 'compatible_recovery.json')
    expected = {descriptor.get(key) for key in ('recovery_bundle_file', 'source_bundle_file', 'report_file')} | {'migration-recovery-approval.json', 'transport-source.json', 'compatible_recovery.json', 'provenance.json', 'release.json', 'migrations.json', 'run.json', 'artifact.json', 'validation-plan.json'}
    require(len(expected) == 12 and set(file_inventory(root)) == expected, 'compatible material paths collide, are missing or unexpected')
    bundle = ordinary(root, descriptor.get('recovery_bundle_file'))
    source_bundle = ordinary(root, descriptor.get('source_bundle_file'))
    require(digest(source_bundle) == source['source_bundle_sha256'], 'offline source.bundle raw hash differs')
    require(digest(ordinary(root, 'provenance.json')) == source['provenance_sha256'], 'export provenance bytes differ')
    provenance = json_file(root, 'provenance.json')
    binding = approval['compatible_recovery']
    refs = git(root, 'bundle', 'list-heads', str(source_bundle)).decode().splitlines()
    require(len(refs) == 2 and set(refs) == {binding['recovery_main_sha']+' refs/heads/main', binding['recovery_release_sha']+' refs/heads/recovery'}, 'offline source.bundle must have exactly the approved main/recovery refs')
    require(provenance.get('kind') == 'compatible_recovery_export_v1' and provenance.get('repository') == REPOSITORY and provenance.get('workflow') == WORKFLOW and provenance.get('event') == 'workflow_dispatch', 'export provenance context differs')
    for key, expected in {'release_sha': binding['recovery_release_sha'], 'main_sha': binding['recovery_main_sha'], 'control_sha': source['export_control_sha'], 'run_id': source['run_id'], 'run_attempt': source['run_attempt'], 'api_digest': binding['api_digest'], 'web_digest': binding['web_digest'], 'target_manifest_sha256': binding['target_manifest_sha256']}.items():
        require(provenance.get(key) == expected, 'export provenance binding differs: '+key)
    files = provenance.get('files', {})
    require(set(files) == ARTIFACT_FILES-{'provenance.json'}, 'export file inventory differs')
    for name, path in {'recovery.tar.gz': bundle, 'source.bundle': source_bundle, 'release.json': ordinary(root, 'release.json'), 'migrations.json': ordinary(root, 'migrations.json')}.items():
        require(files.get(name) == digest(path), 'export original bytes differ: '+name)
    run, artifact = json_file(root, 'run.json'), json_file(root, 'artifact.json')
    publication_metadata(source, run, artifact)
    parser = module(control, 'release_orchestrator').parse_instant
    tested = parser(json_file(root, descriptor.get('report_file'))['tested_at_utc'])
    require(parser(run['created_at']) <= parser(provenance['generated_at_utc']) <= parser(run['updated_at']) <= tested, 'export/run/drill UTC order differs')
    require(parser(run['created_at']) <= parser(artifact['created_at']) <= parser(run['updated_at']), 'artifact/run UTC order differs')
    plan = json_file(Path(plan_file).parent, Path(plan_file).name)
    with tempfile.TemporaryDirectory(prefix='recovery-material-check-') as temp:
        extracted = Path(temp)/'oci'
        safe_archive(bundle, extracted)
        check_oci(control, extracted, binding['recovery_release_sha'], plan['manifest'], binding)
        for name in ('release.json', 'migrations.json'):
            require((extracted/name).read_bytes() == ordinary(root, name).read_bytes(), 'standalone metadata differs from original tar')
    command([sys.executable, '-I', '-B', str(ordinary(control, 'scripts/release_orchestrator.py')), 'check-compatible-recovery', str(plan_file), str(ordinary(root, 'migration-recovery-approval.json')), str(root), binding['legacy_business_sha']])
    return approval


def prepare_material(control, control_sha, candidate_root, candidate, bundle):
    control = Path(control).absolute()
    control_identity(control, control_sha)
    selected = approved_selection(control, candidate, control_sha)
    if selected is None:
        return {'mode': 'legacy'}
    require(candidate != control_sha, 'approval control C must be later than business candidate B')
    git(control, 'merge-base', '--is-ancestor', candidate, control_sha)
    original_selection, _ = selected
    dest = Path(bundle)/'compatible-recovery'
    require(not dest.exists() and not dest.is_symlink(), 'compatible material output already exists')
    require(Path(bundle).is_dir() and not Path(bundle).is_symlink(), 'existing application bundle required')
    with tempfile.TemporaryDirectory(prefix='recovery-download-') as temp:
        # Capture C's ordinary files before network activity. All later copies
        # read this private snapshot; no post-download worktree reread supplies
        # approval/source/descriptor/report bytes to the resulting bundle.
        fixed_control = Path(temp)/'control'
        snapshot_controls(control, control_sha, fixed_control)
        selection = Path(temp)/'selection'
        selection.mkdir(mode=0o700)
        names = ['approval.json', 'transport-source.json', 'compatible_recovery.json']
        for name in names:
            raw = pinned_file(control, ordinary(original_selection, name), control_sha)
            path = selection/name
            path.write_bytes(raw)
            path.chmod(0o600)
        descriptor = json_file(selection, 'compatible_recovery.json')
        require(descriptor.get('kind') == 'compatible_application_recovery_v1', 'recovery descriptor kind differs')
        report_name = str(relative_name(descriptor.get('report_file')))
        raw = pinned_file(control, ordinary(original_selection, report_name), control_sha)
        report = selection/report_name
        report.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with report.open('xb') as stream:
            stream.write(raw)
        report.chmod(0o600)
        approval = json_file(selection, 'approval.json')
        source = check_source(selection, approval)
        dest.mkdir(mode=0o700)
        archive = Path(temp)/'artifact.zip'
        run, artifact = download_approved(source, archive)
        downloaded = Path(temp)/'files'
        safe_archive(archive, downloaded, zipped=True)
        require(set(file_inventory(downloaded)) == ARTIFACT_FILES, 'unexpected file in recovery artifact')
        targets = {'recovery.tar.gz': descriptor.get('recovery_bundle_file'), 'source.bundle': descriptor.get('source_bundle_file'), 'provenance.json': 'provenance.json', 'release.json': 'release.json', 'migrations.json': 'migrations.json'}
        require(len(set(targets.values()) | {descriptor.get('report_file'), 'migration-recovery-approval.json', 'transport-source.json', 'compatible_recovery.json', 'validation-plan.json', 'run.json', 'artifact.json'}) == 12, 'material paths collide')
        for name, relative in targets.items():
            relative_name(relative)
            path = dest/relative
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.copyfile(ordinary(downloaded, name), path)
            path.chmod(0o600)
        copies = {'approval.json': 'migration-recovery-approval.json', 'transport-source.json': 'transport-source.json', 'compatible_recovery.json': 'compatible_recovery.json', descriptor['report_file']: descriptor['report_file']}
        for name, relative in copies.items():
            path = dest/relative
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.copyfile(ordinary(selection, name), path)
            path.chmod(0o600)
            expected = pinned_file(control, ordinary(original_selection, name), control_sha)
            require(path.read_bytes() == expected, 'final prepared selection differs from C Git object')
        write_json(dest/'run.json', run)
        write_json(dest/'artifact.json', artifact)
        plan = transport_plan(control, candidate_root, candidate, approval, dest/'validation-plan.json', fixed_control=fixed_control)
        approved_main = approval['compatible_recovery']['recovery_main_sha']
        git(control, 'merge-base', '--is-ancestor', approved_main, 'refs/remotes/origin/main')
        validate_material(fixed_control, dest, dest/'validation-plan.json')
    return {'mode': 'compatible_recovery', 'candidate_sha': candidate, 'manifest_sha256': canonical(plan['manifest']), 'files': file_inventory(dest)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('export', 'prepare'))
    parser.add_argument('--control-root', type=Path, required=True)
    parser.add_argument('--control-sha', required=True)
    parser.add_argument('--candidate-sha', required=True)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--api-digest')
    parser.add_argument('--web-digest')
    args = parser.parse_args()
    try:
        if args.action == 'export':
            result = export_material(args.source_root, args.control_root, args.control_sha, args.candidate_sha, args.api_digest, args.web_digest, args.output)
        else:
            result = prepare_material(args.control_root, args.control_sha, args.source_root, args.candidate_sha, args.output)
        print(json.dumps(result, sort_keys=True))
    except (RuntimeError, ValueError, OSError, KeyError, TypeError) as error:
        print('GATE_FAILED:recovery_transport: '+str(error), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
