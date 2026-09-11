## 1. Core state machine

- [x] 1.1 Create `src/preempt-takeover.ts` exporting `PreemptTakeover` with a single `{ text, reissued }` slot and narrow host-facing methods (`capture`, `isReissuedTakeover`, `takeForReissue`, `clear`), dependency-free, with a doc comment stating the single-slot and text-equality-guard limitations plus a usage example; verify `npx tsc -p tsconfig.build.json` compiles the new file cleanly.
- [x] 1.2 Implement the capture decision so `capture(text)` records text exactly and `isReissuedTakeover` returns true only for an exact-text match on an already-reissued takeover, clearing the slot on match; verify a unit test covers capture-then-match passthrough.
- [x] 1.3 Implement `takeForReissue()` to return the captured text once and mark it re-issued, returning `null` when empty or already re-issued; verify a unit test covers at-most-once re-issue and byte-for-byte fidelity (including whitespace/unicode).

## 2. Tests

- [x] 2.1 Add `test/preempt-takeover.test.ts` covering every spec scenario: capture on preempt, passthrough when not preempting, re-entrancy guard pass-through-and-clear, non-matching input does not clear, idle re-issue once, no re-issue when empty/already re-issued, reset/clear semantics; verify `npx vitest run` passes for the new file.
- [x] 2.2 Add an edge-case test that a second `capture` is only valid after settle/reset (single-slot invariant); verify the test fails if the slot silently overwrites without reset.

## 3. Export & packaging

- [x] 3.1 Add the `./preempt-takeover` entry (types + import) to the `package.json` exports map and verify `node -e "require('./package.json').exports['./preempt-takeover']"` resolves and `npm run build` emits `dist/preempt-takeover.{js,d.ts}`.
- [x] 3.2 Bump the package minor version and update `README.md` with a short `preempt-takeover` section (what it does, when a plugin needs it, link to the doc-comment usage example); verify the README renders and the version is consistent with the changelog/release flow.

## 4. Validation

- [x] 4.1 Run the repo's full check (`npm test` / build / lint as configured) and verify all green with the new module included.
- [x] 4.2 In a scratch consumer (or pi-continue-watchdog's worktree without committing), import `pi-extension-utils/preempt-takeover` and confirm the exported API surface matches the design (capture / isReissuedTakeover / takeForReissue / clear); verify a type-level consumer compiles.
