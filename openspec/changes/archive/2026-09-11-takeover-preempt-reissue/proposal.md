## Why

pi-coding-agent 0.85.1 made `ctx.abort()` asynchronous: an in-flight hidden
inquiry run (a decision or reflection prompt the plugin owns) no longer stops
synchronously, so a user input that arrives while that hidden run is streaming
is classified by Pi as `steer` into the hidden run. When the abort finally
completes, Pi clears the steering queue — the user's message is silently
dropped and never delivered to the model. Plugins that abort a hidden run on
user takeover need a small, reusable mechanism to capture the takeover text and
re-issue it as a fresh user turn after the hidden run settles, so user input is
never lost. This belongs in pi-extension-utils because the mechanism is
independent of any single plugin's decision/reflection protocol and can be
reused by any plugin that preempts a hidden run on user input.

## What Changes

- Add a new pure, dependency-free module `src/preempt-takeover.ts` exporting a
  takeover-capture state machine plus narrow interfaces for the Pi
  interactions the host plugin must wire up (input-hook action decision and
  re-issue send).
- The state machine owns only the *decisions*: whether an incoming input is a
  re-issued takeover that must pass through untouched (re-entrancy guard), and
  which captured takeover text is ready to re-issue once the host is idle. All
  Pi effects — aborting the hidden run, returning `handled` vs `continue` from
  the input hook, calling `sendUserMessage` — stay in the consuming plugin's
  adapter layer.
- New export path `pi-extension-utils/preempt-takeover` in `package.json`.
- **Scope**: this change delivers only the shared utility module, its tests,
  and a published version bump. Wiring it into pi-continue-watchdog (and
  unblocking its pi-coding-agent 0.85.1 dependency bump) is a follow-up in that
  repo, not part of this change.
- No breaking changes to existing exports.

## Capabilities

### New Capabilities
- `preempt-takeover`: Capture-and-reissue semantics for user input that
  preempts a plugin-owned hidden run, covering the re-entrancy guard, the
  capture decision, and the re-issue decision once the host is idle.

### Modified Capabilities
<!-- none -->

## Impact

- `src/preempt-takeover.ts` (new), `test/preempt-takeover.test.ts` (new),
  `package.json` exports map (additive), version bump for release.
- Consumers: pi-continue-watchdog (immediate; unblocks its
  pi-coding-agent/pi-tui 0.85.1 bump), and any future plugin that aborts a
  hidden run on user input.
- No changes to existing modules (`xml`, `pi-inquiry`, `pi-agent-state`,
  `process-domain`, `semantic-hook`).
