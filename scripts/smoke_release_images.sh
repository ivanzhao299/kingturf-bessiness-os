#!/usr/bin/env bash
# Isolated runner: real approved API/Web images against the CI 72-migration database.
set -euo pipefail
bundle=$1
prefix="kt-image-smoke-${GITHUB_RUN_ID:-local}"
api=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["images"]["api"]["local_ref"])' "$bundle/transport.json")
web=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["images"]["web"]["local_ref"])' "$bundle/transport.json")
release_sha=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["release_sha"])' "$bundle/release.json")
cleanup() { docker rm -f "$prefix-api" "$prefix-web" > /dev/null 2>&1 || true; }
trap cleanup EXIT
# Local test-only database and secrets; no production material.
docker run -d --pull never --name "$prefix-api" --network host -e NODE_ENV=production -e API_HOST=0.0.0.0 -e API_PORT=3000 -e DATABASE_URL -e SESSION_SECRET=isolated-image-verification-only-32bytes -e WEBSITE_LEAD_INGEST_SECRET=isolated-image-verification-only-32bytes -e KINGTURF_RELEASE_SHA="$release_sha" -e KINGTURF_RELEASE_ENVIRONMENT=production -e KINGTURF_RELEASE_BUILT_AT=image-smoke -e KINGTURF_WRITE_FENCE=enabled "$api" > /dev/null
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/ready > /dev/null; then break; fi
  test "$attempt" -lt 30
  sleep 2
done
curl -fsS http://127.0.0.1:3000/health | python3 -c 'import json,sys;assert json.load(sys.stdin)["status"]=="ok"'
curl -fsS http://127.0.0.1:3000/version | python3 -c 'import json,sys;assert json.load(sys.stdin)["sha"]==sys.argv[1]' "$release_sha"
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/auth/login)" = 503
docker run -d --pull never --name "$prefix-web" --network host --add-host api:127.0.0.1 "$web" > /dev/null
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8080/ready > /dev/null; then break; fi
  test "$attempt" -lt 20
  sleep 1
done
curl -fsS http://127.0.0.1:8080/ | python3 -c 'import sys;assert "<html" in sys.stdin.read().lower()'
# Compare immutable identities again after both images have really started.
python3 - "$bundle" "$prefix" <<'PY'
import json,subprocess,sys
from pathlib import Path
b=Path(sys.argv[1]);r=json.loads((b/'transport.json').read_text())
for s,i in r['images'].items():
 c=json.loads(subprocess.check_output(['docker','inspect',sys.argv[2]+'-'+s]))[0]
 assert c['Image']==i['target']['image_id'] and c['Config']['Image']==i['local_ref'] and c['State']['Running']
 image=json.loads(subprocess.check_output(['docker','image','inspect',c['Image']]))[0]
 assert image['RootFS']['Layers']==i['diff_ids']
print('approved API/Web started against 72-schema; health/ready/version, Web HTML and write fence passed')
PY
