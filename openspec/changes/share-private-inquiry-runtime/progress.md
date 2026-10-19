# Progress — share-private-inquiry-runtime

## Step 1: Preparation script + pinned dependency (D1, task 2.1 partially)
Files: scripts/prepare-private-runtime.mjs, scripts/import-check.ts, patches/pi-subagents-0.79.0/{manifest.json,watchdog-runtime.ts,watchdog-runtime.d.ts}, package.json (deps + postinstall/prepack + ./private-inquiry export stub), package-lock.json, test/prepare-private-runtime.test.ts
Retry seam: manifest replaces hard-coded setAutoRetryEnabled(false) with per-launch `autoRetryPolicy?: "disabled" | "native"` + applyChildRetryPolicy(session, launch.autoRetryPolicy); prepared entry passes input.retryPolicy through.
Command: npx vitest run test/prepare-private-runtime.test.ts → 2 passed (patches pinned runtime, entry loads via tsx, idempotent re-run, refuses symlinked/shared runtime via realpath with PIU_PRIVATE_RUNTIME_ROOT test override).

## Step 2: `src/private-inquiry.ts` subpath (D6 lazy import, D2/D3/D4/D5 skeleton)
Files: src/private-inquiry.ts, package.json (./private-inquiry export), dist build
- Lazy runtime import: only `openPrivateInquiry` → `loadPrivateRuntime()` imports the private entry; old entry points stay inert.
- Frozen source: captureSource + exported isReplayableEntry/latestReplayableAnchor; open tool batch walks back to last replayable entry; typed PrivateInquirySetupError.
- Result-file lifecycle: no-follow reset/read, {} per terminal attempt, typed setup vs format failures.
- Typed InquiryOutcome: accepted/exhausted/cancelled/stale/setup-failure/execution-failure; isCurrent() before each correction and before acceptance.
- Retry snapshot passed through fork (retryPolicy: "disabled"|"native").
- Immediate cancel: signal listener revokes authority then aborts the exact child; dispose idempotent, removes only the owned dir.
Command: npx tsc -p tsconfig.json --noEmit → clean; npx eslint src/private-inquiry.ts → clean; npm run build:dist → dist/private-inquiry.{js,d.ts} emitted.

## Step 3: frozen-source conformance tests (task 1.3 partial: frozen-source capture)
Files: test/private-inquiry-source.test.ts
Command: npx vitest run test/private-inquiry-source.test.ts → 4 passed
- Open tool batch walks back to last replayable entry (synthetic + real SessionManager).
- No replayable entry → typed PrivateInquirySetupError("no-replayable-anchor").
- Importing the subpath stays inert (no PI initialization).

## Step 4 (parent): moved Continue core + ported conformance
- src/private-inquiry/core.ts = Continue src/private-decision.ts @42387d7 moved verbatim; changes: runtime import path, consumer `validate` callback (generic T) instead of Continue's schema, `invalidAttemptLimit`, `naming` {tag,fileName,dirPrefix} (Continue passes its literals → zero-literal adoption), review gate moved to consumer policy, observer copies via shallowCopy (primitives allowed).
- The earlier hand-written loop (failed: valid write → exhausted, stream cancel hang) and its tests were deleted; src/private-inquiry.ts is a thin re-export + captureAnchor/isReplayableEntry/latestReplayableAnchor + lazy createPrivateRuntime.
- `npm run test:core` → Continue's 28 tests pass against the moved core.

## Step 5: read-only evidence profile (patches/pi-subagents-0.79.0/watchdog-runtime.ts)
- fork.profile {kind:"read-only-evidence", maxHelperCalls?=10}: tools write+read/ls/grep/find; helper-only batch admitted whole or rejected whole before effect; one operation-wide allowance; tool_call hook blocks anything not admitted.
- test/private-inquiry-evidence.node-test.ts (real Pi 1.3.0): 7/7. Ablation (child.abort() removed) fails the stream-abort test.

## Step 6: packaging
- Fixed: prepack logged to stdout (broke `npm pack --json`); `files` lacked scripts/patches; prepare script now finds a hoisted dependency.
- test/private-inquiry-packed-e2e.mjs: production-only tarball install + real Pi host → decision, 1 request.
- npm run check exit 0; Node 22.23.3 node tests 35/35; bun/deno acceptance green.
