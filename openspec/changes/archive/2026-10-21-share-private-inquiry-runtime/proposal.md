## Why

Continue now owns a verified private pi-subagents fork, file-result channel and bounded same-child execution. Reflect needs the same mechanisms; copying them would duplicate security, cancellation and distribution fixes. Put their common execution module in pi-extension-utils before migrating either consumer.

## What Changes

- Add the independently imported `pi-extension-utils/private-inquiry` entry point. The shared module owns the pinned private runtime dependency and patch, effective full-fork creation, guarded result-file lifecycle, controlled lookup/result execution, bounded format correction, typed failures and exact-child cleanup.
- Supply payload validation and prompt text from consumers. Keep their triggers, counters, reports, final-effect accounting, semantic review and publication outside the shared module.
- Support two real execution profiles: Continue's designated-result-write-only flow and Reflect's limited helper lookups followed by its result write. Preserve one child across correction and any consumer-authorized follow-up inquiry; the consumer bounds business follow-ups.
- Keep old entry points import-isolated from Pi and private runner initialization. The selected single-package design adds installation dependencies; the package must no longer claim zero runtime dependencies as a whole.
- Require Pi >=1.3.0 for the new entry point, without upgrading a global host or imposing Pi initialization on existing dependency-free utilities. Keep existing Node/Bun/Deno utility contracts.

## Capabilities

### New Capabilities

- `private-inquiry-runtime`: private full-fork execution, file-only typed results, two bounded tool profiles, cancellation, packaging and consumer isolation.

### Modified Capabilities

None. Existing process-domain, inquiry-folding and takeover entry points retain their contracts.

## Impact

- New shared implementation, package subpath, pinned runtime preparation/distribution and conformance tests in this repository; exact filenames are implementation choices within that module.
- Continue will consume this module in `pi-continue-watchdog/openspec/changes/consume-shared-private-inquiry-runtime/`; Reflect will consume it in `pi-reflect-watchdog/openspec/changes/isolate-reflections-in-private-fork/`. This repository owns the shared Interface contract; those changes own consumer integration.
- Verify clean Git and packed installations, SDK singleton resolution, no public pi-subagents discovery and unchanged old entry-point behavior. Isolated imports do not eliminate package installation cost.
- Planning only. No runtime edits, dependency installation, commit, push or global extension modification is authorized by these artifacts.
