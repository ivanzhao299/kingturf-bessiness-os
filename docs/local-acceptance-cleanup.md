# Local acceptance artifacts

`.local-acceptance/` is a local-only workspace for disposable acceptance evidence. It is
gitignored, must not be added to commits, and is not part of CI or deployment inputs.

When the local artifacts are no longer needed, review the directory first and run the explicit
cleanup script manually:

```sh
node scripts/analysis/clean-local-acceptance.mjs
```

The script is never invoked automatically. Use `--check` for a read-only target-path self-test:

```sh
node scripts/analysis/clean-local-acceptance.mjs --check
```

Without `--check`, it refuses to run unless the resolved target is exactly the repository's
`.local-acceptance/` child, so it cannot be redirected to the repository root or another directory.
