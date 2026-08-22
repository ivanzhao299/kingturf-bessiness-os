# Feishu to Codex Thread Synchronization

Updated: 2026-08-22 Asia/Shanghai

## Canonical route

- Feishu group: `oc_7c814a358cfe3909f470495d77c4f5c1`
- Codex thread: `019fefdf-1b1c-7f73-89f8-467591a9e568`
- Repository: `/Users/mac/Documents/kingturf-bessiness-os`
- OpenClaw route agent: `kingturf-codex-bridge`

This is a transport route, not a parallel development lane. The route agent must forward the original Feishu instruction into the existing Codex thread and must not implement KingTurf work independently.

## Inbound flow

The exact Feishu group is matched by an OpenClaw peer binding. The isolated route agent forwards the original UTF-8 message through `codex exec resume` using the canonical Codex thread ID and repository. Codex progress and the final answer are returned to the same Feishu group.

## Outbound flow

Codex's existing turn-ended notifier is wrapped by a thread-filtered dispatcher. Only completed answers from the canonical KingTurf thread are sent to the configured Feishu group. The existing Computer Use notification continues to run. When a turn originated from the Feishu bridge, a lock suppresses the second notifier copy.

## Safety properties

- The route is restricted to one exact Feishu group peer.
- The bridge does not create another Codex session or checkout.
- The original message is base64-transported to avoid shell interpolation.
- Plaintext credentials and tokens are not recorded in bridge files.
- A single-flight lock prevents concurrent bridge writers.
- Codex retains the normal authorization and destructive-action boundaries for remote commands.

## Verification

- OpenClaw configuration validation: passed.
- Gateway restart: passed.
- Feishu live probe: `enabled, configured, running, connected, works`.
- Route roster: one peer-specific rule assigned to `kingturf-codex-bridge`.
- Codex-to-Feishu notification test: delivered.
- Activation receipt: `om_x100b67a63eff88a4b273641f0f2eede`.

## Recovery

If inbound routing fails, validate the OpenClaw configuration, inspect the peer binding and run a Feishu live probe before changing the route. If outbound delivery fails, validate the Codex notifier script and the OpenClaw Gateway. Do not replace the canonical thread ID or create a parallel development session as a shortcut.
