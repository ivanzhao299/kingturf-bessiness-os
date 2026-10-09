#!/usr/bin/env python3
"""Check approved local recovery artifacts only; never restore or contact production."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import tarfile


def require(value):
    if not value:
        raise ValueError('Recovery material acceptance failed')


def no_duplicates(pairs):
    result = {}
    for k, v in pairs:
        require(k not in result)
        result[k] = v
    return result


def verify(root, manifest, production_sha, max_age_hours, now=None):
    require(re.fullmatch(r'[0-9a-f]{40}', production_sha))
    require(math.isfinite(max_age_hours) and max_age_hours > 0 and math.isfinite(max_age_hours * 3600))
    root = Path(root).resolve(strict=True)
    require(root.is_dir())
    data = json.loads(Path(manifest).read_text(), object_pairs_hook=no_duplicates)
    require(data['format_version'] == 1 and data['source_sha'] == production_sha)
    recorded = datetime.fromisoformat(data['snapshot_at'].replace('Z', '+00:00'))
    require(recorded.tzinfo is not None)
    current = now or datetime.now(timezone.utc)
    age = (current - recorded).total_seconds()
    require(0 <= age <= max_age_hours * 3600)
    artifacts = data['artifacts']
    require(set(artifacts) == {'database', 'attachments', 'configuration'})
    for kind, item in artifacts.items():
        relative = Path(item['path'])
        require(not relative.is_absolute() and '..' not in relative.parts)
        path = root / relative
        # Reject symlinks in every component, not just the leaf.
        check = root
        for part in relative.parts:
            check = check / part
            require(not check.is_symlink())
        path = path.resolve(strict=True)
        require(path.is_relative_to(root) and path.is_file())
        require(isinstance(item['bytes'], int) and not isinstance(item['bytes'], bool))
        require(item['bytes'] > 0 and path.stat().st_size == item['bytes'])
        require(re.fullmatch(r'[0-9a-f]{64}', item['sha256']))
        with path.open('rb') as f:
            require(hashlib.file_digest(f, 'sha256').hexdigest() == item['sha256'])
        if kind == 'database':
            with path.open('rb') as f:
                require(f.read(5) == b'PGDMP')
        else:
            with tarfile.open(path) as archive:
                for member in archive:
                    name = Path(member.name)
                    require(not name.is_absolute() and '..' not in name.parts)
                    require(member.isdir() or member.isfile())
    # This result deliberately never represents restored-data acceptance.
    return {'material_integrity': 'PASS', 'artifacts': 3,
            'restore_verified': False, 'configuration_validated': False,
            'independent_copy_verified': False, 'provenance_verified': False,
            'snapshot_time_verified': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--production-sha', required=True)
    parser.add_argument('--max-age-hours', type=float, required=True)
    args = parser.parse_args()
    try:
        result = verify(args.root, args.manifest, args.production_sha, args.max_age_hours)
    except (KeyError, TypeError, ValueError, OSError, tarfile.TarError):
        # Do not echo paths, archive names, connection strings or secret-bearing payloads.
        print(json.dumps({'material_integrity': 'FAIL', 'restore_verified': False}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
