#!/usr/bin/env python3
"""Offline OCI distribution preserving approved registry digests; no credentials on host."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
import subprocess
import threading
import tarfile

DIGEST = re.compile(r'sha256:[0-9a-f]{64}')
INDEX = {'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'}
MANIFEST = {'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'}
PORT = 15432


def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)


def checksum(path):
    with Path(path).open('rb') as stream:
        return 'sha256:' + hashlib.file_digest(stream, 'sha256').hexdigest()


def blob_path(layout, digest):
    require(isinstance(digest, str) and DIGEST.fullmatch(digest), 'Invalid sha256 digest')
    base = Path(layout).resolve()
    path = base / 'blobs' / 'sha256' / digest[7:]
    require(path.is_file() and not path.is_symlink() and path.resolve().parent == base / 'blobs' / 'sha256', 'Missing or redirected OCI blob')
    return path


def verify_layout(layout, approved, os_name='linux', arch='amd64'):
    """Hash every reachable descriptor, including attestation/other-platform blobs."""
    blobs, documents = {}, {}

    def visit(digest, size=None, media=None):
        path = blob_path(layout, digest)
        require(checksum(path) == digest, 'OCI blob checksum mismatch')
        require(size is None or (type(size) is int and size == path.stat().st_size), 'OCI descriptor size mismatch')
        if digest in blobs:
            require(blobs[digest]['media'] == media, 'Conflicting OCI descriptor media type')
            return documents.get(digest)
        if media is None:
            doc = json.loads(path.read_bytes())
            media = doc.get('mediaType')
        else:
            doc = json.loads(path.read_bytes()) if media in INDEX | MANIFEST else None
        blobs[digest] = {'path': path, 'media': media or 'application/octet-stream', 'size': path.stat().st_size}
        if doc is not None:
            documents[digest] = doc
            require(doc.get('schemaVersion') == 2 and doc.get('mediaType', media) == media, 'Invalid OCI manifest')
            descriptors = doc.get('manifests') if media in INDEX else [doc['config'], *doc['layers']]
            require(isinstance(descriptors, list) and descriptors, 'Empty OCI descriptor list')
            for desc in descriptors:
                require(not desc.get('urls'), 'External OCI blob URLs are forbidden')
                visit(desc['digest'], desc['size'], desc['mediaType'])
        return doc

    root = visit(approved)
    require(root.get('mediaType') in INDEX | MANIFEST, 'Unsupported approved root media type')
    manifest_digest = approved
    if root['mediaType'] in INDEX:
        platforms = [d for d in root['manifests'] if d.get('platform', {}).get('os') == os_name and d.get('platform', {}).get('architecture') == arch and not d.get('platform', {}).get('variant')]
        require(len(platforms) == 1, 'Target platform missing or ambiguous')
        manifest_digest = platforms[0]['digest']
    manifest = documents[manifest_digest]
    require(manifest['mediaType'] in MANIFEST, 'Target must be an image manifest')
    config_digest = manifest['config']['digest']
    config = json.loads(blobs[config_digest]['path'].read_bytes())
    require(config.get('os') == os_name and config.get('architecture') == arch, 'Config platform mismatch')
    rootfs = config.get('rootfs', {})
    diff_ids = rootfs.get('diff_ids', [])
    require(rootfs.get('type') == 'layers' and len(diff_ids) == len(manifest['layers']) and all(DIGEST.fullmatch(x) for x in diff_ids), 'Invalid config layer identity')
    identity = {'approved_digest': approved, 'platform': os_name + '/' + arch, 'manifest_digest': manifest_digest, 'config_digest': config_digest, 'layers': manifest['layers'], 'diff_ids': diff_ids, 'blob_count': len(blobs)}
    return identity, blobs


def load_bundle(root):
    root = Path(root)
    approval = json.loads((root / 'release.json').read_bytes())
    require(re.fullmatch(r'[0-9a-f]{40}', approval['release_sha']), 'Invalid release SHA')
    require(set(approval['images']) == {'api', 'web'}, 'Both approved images required')
    identities, content = {}, {}
    for service, image in approval['images'].items():
        require(image['source'] == 'ghcr.io/ivanzhao299/kingturf-erp-' + service, 'Unapproved source repository')
        identity, blobs = verify_layout(root / service, image['digest'])
        identity['source'] = image['source']
        identity['local_ref'] = f'127.0.0.1:{PORT}/kingturf-erp-{service}@{image["digest"]}'
        identities[service] = identity
        content['kingturf-erp-' + service] = blobs
    return approval, identities, content


def registry(content):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def send_error(self, *args, **kwargs):
            # Docker's containerd resolver probes HTTPS first even for loopback.
            # A valid HTTP status on the rejected TLS probe enables its existing
            # loopback-only HTTP fallback; BaseHTTPRequestHandler otherwise sends
            # a headerless HTTP/0.9 body, producing an unrecognized TLS failure.
            self.request_version = 'HTTP/1.1'
            super().send_error(*args, **kwargs)

        def log_message(self, *_args):
            pass

        def do_HEAD(self):
            self.do_GET()

        def do_GET(self):
            if self.path in ('/v2/', '/v2'):
                self.send_response(200)
                self.send_header('Docker-Distribution-Api-Version', 'registry/2.0')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            match = re.fullmatch(r'/v2/(kingturf-erp-(?:api|web))/(manifests|blobs)/(sha256:[0-9a-f]{64})', self.path)
            item = content.get(match[1], {}).get(match[3]) if match else None
            if item is None or (match[2] == 'manifests' and item['media'] not in INDEX | MANIFEST):
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Docker-Distribution-Api-Version', 'registry/2.0')
            self.send_header('Docker-Content-Digest', match[3])
            self.send_header('Content-Type', item['media'])
            self.send_header('Content-Length', str(item['size']))
            self.end_headers()
            if self.command == 'GET':
                with item['path'].open('rb') as stream:
                    shutil.copyfileobj(stream, self.wfile)

    return ThreadingHTTPServer(('127.0.0.1', PORT), Handler)


def docker(*args):
    p = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=600)
    require(p.returncode == 0, 'Docker image operation failed: ' + ' '.join(args[:2]))
    return p.stdout


def verify_exported_config(identity):
    # Image.Id means config digest with the classic store, but Docker 29's
    # containerd store reports index/manifest IDs. Inspect alone cannot prove the
    # raw config digest. Export the selected platform and hash its actual bytes.
    process = subprocess.Popen(['docker','image','save','--platform=linux/amd64',identity['local_ref']],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    found = False
    try:
        with tarfile.open(fileobj=process.stdout,mode='r|') as archive:
            for member in archive:
                if member.isfile() and member.size < 5*1024**2 and member.name in (identity['config_digest'][7:]+'.json','blobs/sha256/'+identity['config_digest'][7:]):
                    raw = archive.extractfile(member).read()
                    require('sha256:'+hashlib.sha256(raw).hexdigest()==identity['config_digest'],'Exported target config bytes differ')
                    found=True
        require(process.wait(timeout=120)==0 and found,'Selected target config could not be verified')
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.kill()
            process.wait()


def check_image(identity):
    image = json.loads(docker('image', 'inspect', identity['local_ref']))[0]
    require(identity['local_ref'] in image['RepoDigests'], 'Approved root digest not retained by target daemon')
    descriptor = image.get('Descriptor')
    if descriptor:
        require(image['Id']==descriptor['digest']==identity['approved_digest'],'Target root descriptor mismatch')
        platform=json.loads(docker('image','inspect','--platform=linux/amd64',identity['local_ref']))[0]
        require(platform['Id']==platform.get('Descriptor',{}).get('digest')==identity['manifest_digest'],'Selected target manifest mismatch')
    else:
        require(image['Id']==identity['config_digest'],'Classic target config digest mismatch')
    require(image['RootFS']['Layers'] == identity['diff_ids'], 'Target uncompressed layer identities mismatch')
    require(image['Os'] + '/' + image['Architecture'] == identity['platform'], 'Target image platform mismatch')
    verify_exported_config(identity)
    return {'image_id': image['Id'], 'repo_digests': image['RepoDigests'], 'diff_ids': image['RootFS']['Layers'], 'store': 'containerd' if descriptor else 'classic', 'raw_config_digest':identity['config_digest']}


def import_bundle(root):
    approval, identities, content = load_bundle(root)
    require(docker('version', '--format', '{{.Server.Os}}/{{.Server.Arch}}').strip() == 'linux/amd64', 'Unsupported target daemon platform')
    server = registry(content)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        for identity in identities.values():
            docker('pull', '--platform=linux/amd64', identity['local_ref'])
            identity['target'] = check_image(identity)
    finally:
        server.shutdown()
        server.server_close()
        worker.join()
    return {'release_sha': approval['release_sha'], 'images': identities, 'registry_stopped': True}


def verify_runtime(root):
    approval, identities, _ = load_bundle(root)
    for service, identity in identities.items():
        ids = docker('ps', '-aq', '--filter', 'label=com.docker.compose.project=kingturf-erp-production', '--filter', 'label=com.docker.compose.service=' + service).split()
        require(len(ids) == 1, 'Ambiguous runtime container')
        c = json.loads(docker('inspect', ids[0]))[0]
        target=check_image(identity)
        require(c['Image'] == target['image_id'] and c['Config']['Image'] == identity['local_ref'], 'Runtime image does not match approved artifact')
        if target['store']=='containerd':
            require(c.get('ImageManifestDescriptor',{}).get('digest')==identity['manifest_digest'],'Runtime platform manifest mismatch')
        identity['target']=target
        require(c['State']['Running'] and c['State'].get('Health', {}).get('Status') == 'healthy', 'Runtime container unhealthy')
        identity['container_id'] = c['Id']
    return {'release_sha': approval['release_sha'], 'images': identities}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('verify', 'import', 'runtime', 'serve'))
    parser.add_argument('bundle', type=Path)
    args = parser.parse_args()
    if args.action == 'verify':
        approval, identities, _ = load_bundle(args.bundle)
        report = {'release_sha': approval['release_sha'], 'images': identities}
    elif args.action == 'import':
        report = import_bundle(args.bundle)
    elif args.action == 'runtime':
        report = verify_runtime(args.bundle)
    else:
        _, _, content = load_bundle(args.bundle)
        with registry(content) as server:
            server.serve_forever()
        return
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
