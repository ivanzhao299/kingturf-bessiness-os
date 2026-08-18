#!/bin/sh
set -eu

for script in infra/deployment/kingturf-erp-jump infra/deployment/kingturf-erp-office; do
  sh -n "$script"
done
if SSH_ORIGINAL_COMMAND='uname -a' sh infra/deployment/kingturf-erp-jump </dev/null 2>/dev/null; then
  echo "jump command accepted an arbitrary command" >&2
  exit 1
fi
if SSH_ORIGINAL_COMMAND='kingturf-erp deploy not-a-sha' \
  sh infra/deployment/kingturf-erp-jump </dev/null 2>/dev/null; then
  echo "jump command accepted an invalid SHA" >&2
  exit 1
fi
echo "deployment route contract tests passed"
