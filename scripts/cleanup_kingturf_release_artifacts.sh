#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <absolute-release-directory> <compose-project-name>" >&2
  exit 64
fi

release_directory=$1
compose_project=$2

case "$release_directory" in
  /*) ;;
  *)
    echo "release directory must be absolute" >&2
    exit 64
    ;;
esac

backup_directory="${release_directory}/.release-backups"
test -d "$backup_directory"

latest_metadata=$(find "$backup_directory" -maxdepth 1 -type f -name '*.metadata' -print | LC_ALL=C sort | tail -n 1)
test -n "$latest_metadata"
latest_prefix=${latest_metadata%.metadata}
latest_dump="${latest_prefix}.dump"
test -s "$latest_metadata"
test -s "$latest_dump"

backup_count_before=$(find "$backup_directory" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.metadata' \) | wc -l | tr -d ' ')
find "$backup_directory" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.metadata' \) -print |
  while IFS= read -r artifact; do
    if [ "$artifact" != "$latest_metadata" ] && [ "$artifact" != "$latest_dump" ]; then
      rm -- "$artifact"
    fi
  done

backup_count_after=$(find "$backup_directory" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.metadata' \) | wc -l | tr -d ' ')
test "$backup_count_after" -eq 2

active_image_ids=$(
  docker container ls -aq --filter "label=com.docker.compose.project=${compose_project}" |
    while IFS= read -r container_id; do
      test -n "$container_id" && docker inspect --format '{{.Image}}' "$container_id"
    done |
    LC_ALL=C sort -u
)
test -n "$active_image_ids"

removed_image_count=0
candidate_image_ids=$(docker image ls --no-trunc --filter "label=com.docker.compose.project=${compose_project}" --format '{{.ID}}' | LC_ALL=C sort -u)
for image_id in $candidate_image_ids; do
  if ! printf '%s\n' "$active_image_ids" | grep -Fqx "$image_id"; then
    docker image rm "$image_id"
    removed_image_count=$((removed_image_count + 1))
  fi
done

echo "Kingturf cleanup complete"
echo "backup_artifacts_before=${backup_count_before}"
echo "backup_artifacts_after=${backup_count_after}"
echo "retained_backup=$(basename "$latest_prefix")"
echo "removed_unused_project_images=${removed_image_count}"
df -h "$release_directory"
