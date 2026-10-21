# Design

## Context

See `proposal.md` for motivation. Continue owns a live, accepted private-decision stack: `patches/pi-subagents-0.79.0/watchdog-runtime.ts` (175-line pinned pi-subagents 0.79.0 entry, commit `1008e599…`), its preparation script, and `src/private-decision.ts` (591-line host operation). Reflect needs the same mechanisms for background private reflection. The user confirmed the order: determine Reflect's needs, extract the shared layer here, adapt Reflect first, then Continue, then verify and push all three. Reflect's feasibility round proved the required mechanism on stock Pi 1.3.0: `continue:false`/`nextTurn` cannot replace a native steering slot, an isolated SDK child can execute explicitly selected built-in tools, cooperative `customTools` receive child context and cancel exactly, and parent idle does not observe separate child work. Following the user's decision, native scheduling is NOT a shared-layer concern: consumers trigger, run the child in the background without blocking the parent, and insert results when available.

## Goals / Non-Goals

**Goals:**
- Own the private execution mechanism once behind one typed interface.
- Preserve full effective fork (frozen source), selected model/thinking, exact-child cancellation.
- Two real profiles: Continue result-write-only; Reflect read-only local evidence (read/ls/grep/find + parent-session-file read) with a 10-call budget across up to 3 terminal attempts in the same child.
- Keep existing entry points import-isolated; consumers keep policy.

**Non-Goals:**
- A scheduler, watchdog controller, verdict schema, review service, event bus, or global singleton.
- Public subagent tools, agent catalogs, ambient child extension loading.
- Upgrading global Pi; migrating unrelated utils consumers.
- Pi host patches. The background-trigger/insert model requires none.

## Decisions

### D1. One private runtime dependency, prepared in-tree

The subpath `pi-extension-utils/private-inquiry` owns one runtime dependency on `pi-subagents` pinned at commit `1008e5993e90fcf13b815c97c15a0c54f7f6f116` (0.79.0), same as Continue today. A `postinstall`/`prepack` script, ported from Continue's verified `scripts/prepare-private-runtime.mjs`, verifies upstream source hashes, applies the minimal replacements (optional `agentDir`, per-child `setAutoCompactionEnabled(false)`, and a retry-policy seam), and writes the private `watchdog-runtime.ts`/`.d.ts` entry. It refuses to run when `node_modules/pi-subagents` is a symlink/shared cache (realpath check) and replaces inodes so package-manager hardlinks are never mutated. The runtime dependency is optional for installers that already prepared a copy: `prepare` is idempotent and verifies before writing.

Consumers that require background non-blocking children use the same dependency; the runtime's `createDefaultChildSessionFactory` already supports in-process child sessions with isolated runtimes (`parentProviderRegistry`) and exact abort.

### D2. Frozen qualified source

`openPrivateInquiry` takes an explicit frozen source captured at trigger time: parent session file, anchor entry id, selected provider/model/thinking, provider registry snapshot, and cwd. The fork happens from that anchor after the async child setup starts; no live `SessionManager` is retained across the operation. Busy parent: the anchor is the latest replayable persisted entry — an open or incomplete tool batch is not replayable, so qualification walks back to the last complete entry. Replayable-anchor qualification is an explicit, tested, exported function (`isReplayableEntry`). No replayable source → typed setup failure; never wait for the parent, never abort it, never fall back to fresh or pruned context. Currentness is consumer-owned: the shared layer calls `isCurrent()` before each correction and before accepting a terminal result; false → typed stale outcome with no further child effects. Consumer revocation rules stay in consumers.

### D3. One session, two profiles, one result file

`openPrivateInquiry(source, profile, retry, signal, isCurrent, onActivity)` → `OwnedInquiry { inquire({prompt, correction, validate}), cancel(), dispose() }`. The child is created once per operation; the consumer's validator callback decides payload validity (Reflect's five-field validator, Continue's action schema — never imported by utils). The result file is the only result transport: allocated per operation under `/var/tmp`, reset to `{}` before each terminal attempt, joined to its own response, no-follow checks on every open, distinct typed failures for setup/filesystem vs format. No post-write acknowledgement.

Continue profile = result-write-only: the child exposes exactly the guarded `write` tool for the designated file (as the live `watchdog-runtime.ts` does today). Reflect profile = read-only local evidence: SDK built-in read/ls/grep/find constructed by the shared layer against the consumer cwd, plus a read of the frozen parent session file (same `read` tool; the path is prompt data). One shared 10-helper-call budget across the whole operation; helper-only responses are not missing-result failures; mixed/duplicate/over-budget batches are rejected before any effect; terminal attempts are capped at 3. No ambient extension factories, no proxying of parent tools, no third-party admission.

### D4. Native retry stays a per-consumer policy snapshot

The preparation patch replaces Continue's hard-coded `setAutoRetryEnabled(false)` with a per-child policy passed at launch: Continue passes disabled (its current behavior), Reflect passes native eligibility (its current behavior). The shared layer never mutates global retry state and never copies one consumer's profile onto the other.

### D5. Immediate cancellation, exact-child only

`onActivity` receives official per-child state (working/idle/retry/settled) under an owner namespace and child identity, sourced from the child session's own events — never the parent's aggregate idle. Observers are safe: throwing or mutating callbacks never change accepted results or accounting (copies are handed out).

Cancellation is immediate, not checkpoint-based. Aborting the consumer-supplied `signal` (or calling `cancel()`) at ANY moment must promptly abort the child's in-flight provider request/stream, abort any running admitted helper (read/ls/grep/find, including a spawned grep/find subprocess), and stop any pending correction. Authority is revoked first, then the child is drained. After that, no further provider calls happen and no result is accepted, even if a write already landed: the outcome is a typed cancelled outcome. The parent session and other runs are never aborted. `isCurrent()` checkpoints remain as a backstop. Settle latency after abort must be bounded (conformance asserts <1s with the synthetic provider). `dispose()` is idempotent, removes only owned resources, and never aborts the parent or other runs.

### D6. Import isolation and distribution

The private module imports the pinned runtime lazily (`await import`) only inside `openPrivateInquiry`; root and existing subpaths never import it, so importing `pi-extension-utils` still initializes no Pi runtime. The package ships `dist/` plus the private runtime assets needed for a clean install: the pinned Git dependency in `dependencies` with `postinstall` preparation. Old entry points' portable-host contracts (Node/Bun/Deno) are unchanged; the package stops claiming zero runtime dependencies as a whole. Minimum Pi for the private entry: `>=1.3.0` (peer of the runtime dependency, matching Continue's live baseline).

## Risks / Trade-offs

- [Preparation fails in nested Git/packed installs] → Task 3.1 proves fresh production-only installs of the tarball with real Pi 1.3.0; hardlink/symlink defenses are ported from Continue's verified script.
- [Consumers accidentally change behavior] → Task 4.2 runs installed Continue and the Reflect candidate together with independent public subagents; conformance is ported from Continue's accepted tests.
- [Observers mutate results] → copies handed to callbacks; tested intentionally-failing observers.
- [Background child busy parent] → not a shared risk: consumers own scheduling and insertion (user decision).

## Migration Plan

1. Port Continue's conformance fixtures (stale file, own-response, reset, intentional break) as shared conformance tests against the new interface; add frozen-source/replayable-anchor/isCurrent tests.
2. Implement the subpath: preparation script, private runtime adapter, frozen source, result file lifecycle, profiles, budgets, cancellation, activity observation.
3. Packed production-only install + real Pi 1.3.0 load; portable-host acceptance for old entry points.
4. Hand the pinned candidate to Reflect and Continue adaptations (their own OpenSpec changes).
