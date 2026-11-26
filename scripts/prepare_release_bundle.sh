#!/usr/bin/env bash
# Run on an ephemeral authenticated runner; no registry credentials enter the bundle.
set -euo pipefail
release_sha=$1
api_digest=$2
web_digest=$3
bundle=$(realpath -m "$4")
[[ "$release_sha" =~ ^[0-9a-f]{40}$ && "$api_digest" =~ ^sha256:[0-9a-f]{64}$ && "$web_digest" =~ ^sha256:[0-9a-f]{64}$ ]]
mkdir -p "$bundle"
test -z "$(ls -A "$bundle")"
skopeo_image=quay.io/skopeo/stable@sha256:4b440098ada2bc2623308b0f60f5a5454084b98683e9e7dcecd77bba69797c56
auth_mount=()
auth_option=()
if [ -f "${DOCKER_CONFIG:-$HOME/.docker}/config.json" ]; then
  auth_mount=(-v "${DOCKER_CONFIG:-$HOME/.docker}:/auth:ro")
  auth_option=(--authfile /auth/config.json)
fi
for service in api web; do
  repo="ghcr.io/ivanzhao299/kingturf-erp-$service"
  case "$service" in api) digest=$api_digest;; web) digest=$web_digest;; esac
  docker run --rm "${auth_mount[@]}" "$skopeo_image" inspect "${auth_option[@]}" --raw "docker://$repo:$release_sha" > "$bundle/$service-tag.json"
  actual="sha256:$(sha256sum "$bundle/$service-tag.json" | cut -d ' ' -f 1)"
  test "$actual" = "$digest"
  docker run --rm "${auth_mount[@]}" -v "$bundle:/bundle" "$skopeo_image" copy "${auth_option[@]}" --all --preserve-digests "docker://$repo@$digest" "oci:/bundle/$service:release"
done
RELEASE_SHA="$release_sha" API_DIGEST="$api_digest" WEB_DIGEST="$web_digest" BUNDLE="$bundle" python3 - <<'PY'
import hashlib,json,os,pathlib
root=pathlib.Path(os.environ['BUNDLE'])
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(pathlib.Path('packages/database/migrations').glob('*.sql'))}
assert len(manifest)==81,'This application-only recovery is restricted to the completed 81-migration manifest'
(root/'migrations.json').write_text(json.dumps(manifest,sort_keys=True))
(root/'release.json').write_text(json.dumps({'release_sha':os.environ['RELEASE_SHA'],'migration_manifest_sha256':hashlib.sha256((root/'migrations.json').read_bytes()).hexdigest(),'images':{s:{'source':'ghcr.io/ivanzhao299/kingturf-erp-'+s,'digest':os.environ[s.upper()+'_DIGEST']} for s in ('api','web')}},sort_keys=True))
PY
