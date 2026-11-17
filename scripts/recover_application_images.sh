#!/usr/bin/env bash
# Fixed control, application-only recovery. Host source and migration evidence stay intact.
set -euo pipefail
artifact=$1
bundle="$artifact/extracted"
run_name="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
remote="/data/kingturf-erp/.release-image-recovery/$run_name"
ssh_args=(-o KexAlgorithms=curve25519-sha256 -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_KNOWN_HOSTS_FILE" -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ConnectTimeout=20 -p "$PROD_SSH_PORT")
run_ssh() { ssh "${ssh_args[@]}" "$PROD_SSH_USER@$PROD_SSH_HOST" "$@"; }
# First read-only checks happen before even creating the run's staging directory.
expected_nginx=$(sha256sum infra/nginx/erp.kingturf.cn.conf | cut -d ' ' -f 1)
actual_nginx=$(run_ssh 'sha256sum /etc/nginx/conf.d/erp.kingturf.cn.conf' | cut -d ' ' -f 1)
test "$actual_nginx" = "$expected_nginx"
manifest=$(base64 -w0 "$bundle/migrations.json")
cat scripts/production_preflight.py | run_ssh "python3 - '/data/kingturf-erp' '$manifest' --require-full"
# A unique run directory is retained on failure; no --delete and no source rsync.
run_ssh "set -eu; test ! -L /data/kingturf-erp/.release-image-recovery; mkdir -p /data/kingturf-erp/.release-image-recovery; test ! -e '$remote'; mkdir -m 700 '$remote'"
printf -v ssh_transport '%q ' ssh "${ssh_args[@]}"
rsync -az --partial -e "$ssh_transport" "$artifact/recovery-bundle.tar.gz" "$PROD_SSH_USER@$PROD_SSH_HOST:$remote/bundle.tar.gz"
expected_bundle=$(cut -d ' ' -f 1 "$artifact/recovery-bundle.sha256")
[[ "$expected_bundle" =~ ^[0-9a-f]{64}$ ]]
run_ssh "sh -s -- '$remote' '$expected_bundle'" <<'REMOTE'
set -eu
cd "$1"
actual=$(sha256sum bundle.tar.gz | cut -d ' ' -f 1)
test "$actual" = "$2"
python3 - <<'PYTHON'
import tarfile,pathlib
with tarfile.open('bundle.tar.gz') as t:
    members=t.getmembers()
    assert len(members)<10000 and sum(m.size for m in members)<4*1024**3
    assert all(not pathlib.PurePosixPath(m.name).is_absolute() and '..' not in pathlib.PurePosixPath(m.name).parts and (m.isfile() or m.isdir()) for m in members)
    t.extractall('.', filter='data')
    pathlib.Path('.').chmod(0o700)
PYTHON
REMOTE
# The whole tar is already bound to runner SHA; assert control bytes separately too.
for script in oci_image_transport application_release production_preflight; do
  expected=$(sha256sum "scripts/$script.py" | cut -d ' ' -f 1)
  actual=$(run_ssh "sha256sum '$remote/controls/$script.py'" | cut -d ' ' -f 1)
  test "$expected" = "$actual"
done
mkdir -p "$artifact/results"
run_ssh "RELEASE_SHA='$RELEASE_SHA' RELEASE_CONTROL_SHA='$RELEASE_CONTROL_SHA' python3 '$remote/controls/application_release.py' precheck '$remote'" > "$artifact/results/precheck.jsonl"
# Import and check byte identities while the recovery application remains healthy.
run_ssh "python3 '$remote/controls/oci_image_transport.py' import '$remote' > '$remote/transport.json'"
run_ssh "RELEASE_SHA='$RELEASE_SHA' RELEASE_CONTROL_SHA='$RELEASE_CONTROL_SHA' python3 '$remote/controls/application_release.py' backup '$remote' > '$remote/backup-report.json'"
# Backup stops API only after import, then takes joint materials and rehearses the restore.
# Switch consumes that frozen recovery point; failures recover the previous application.
run_ssh "RELEASE_SHA='$RELEASE_SHA' RELEASE_CONTROL_SHA='$RELEASE_CONTROL_SHA' python3 '$remote/controls/application_release.py' switch '$remote' > '$remote/deployment.json'"
run_ssh "RELEASE_SHA='$RELEASE_SHA' RELEASE_CONTROL_SHA='$RELEASE_CONTROL_SHA' python3 '$remote/controls/application_release.py' postcheck '$remote'" > "$artifact/results/postcheck.json"
# No secrets/config/production data are exported in Actions evidence.
for name in transport runtime deployment authorization; do
  run_ssh "cat '$remote/$name.json'" > "$artifact/results/$name.json"
done
