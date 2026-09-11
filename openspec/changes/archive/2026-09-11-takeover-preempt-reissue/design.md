## Context

pi-coding-agent 0.85.1 made `ctx.abort()` asynchronous. Verified experimentally
against both versions in pi-continue-watchdog's packed e2e harness
(`test/e2e/packed.test.ts`, "interactive and RPC input preempt a streaming
decision once"):

- **0.84.1**: `ctx.abort()` stops the hidden run synchronously. The takeover
  input is then delivered as a new turn; the run continues and issues a third
  model request with role `user`.
- **0.85.1**: `ctx.abort()` returns before the run stops. Pi still sees
  `isStreaming === true` when the takeover prompt arrives, so `prompt()`
  enqueues it as steering into the still-running hidden run. When the abort
  settles, Pi clears the steering queue — the takeover text is dropped, the
  last assistant message is `stopReason: "error"`, and `agent.continue()`
  rejects with "Cannot continue from message role: assistant". The user's
  message never reaches the model.

The verified fix (green on both versions in the same e2e): the input hook
returns `handled` for the takeover (swallowing it before Pi can strand it as
steering), captures the text, and after the preempted run settles and the host
is idle, re-issues it via `options.pi.sendUserMessage(text)` as a fresh user
turn (a new `agent_start`, a third model request with role `user`, no
re-entrancy loop).

Constraints:
- pi-extension-utils is dependency-free and MUST NOT import pi-coding-agent.
  Its modules are pure functions/classes over narrow interfaces (see
  `src/pi-inquiry.ts`: `InquirySendApi`, `InquiryContextApi`; `src/pi-agent-state.ts`:
  `PiAgentStateSource`). The takeover mechanism must follow the same pattern.
- All Pi effects (abort, input-hook action, `sendUserMessage`) belong to the
  consuming plugin's adapter; this module supplies only the decisions and the
  captured state.

## Goals / Non-Goals

**Goals:**
- A pure, testable state machine that answers three questions for the host
  adapter: (1) capture or passthrough for an incoming input, (2) is this input
  a re-issued takeover that must pass through untouched, (3) which takeover
  text is ready to re-issue now that the host is idle.
- Preserve takeover text byte-for-byte; single pending slot; re-issue at most
  once.
- Zero new dependencies; additive `pi-extension-utils/preempt-takeover` export.

**Non-Goals:**
- Wiring into pi-continue-watchdog or any plugin (follow-up in that repo).
- A general "preempt framework" or abort/orchestration logic — pi-reflect-watchdog
  has no input hook and does not preempt user input today (YAGNI).
- Detecting the Pi version or changing behavior per version — the
  capture/re-issue mechanism is version-agnostic (green on 0.84.1 and 0.85.1).

## Decisions

**Decision 1: Pure state machine + narrow host interfaces, mirroring pi-inquiry.**
The module exports a `PreemptTakeover` class holding at most one
`{ text, reissued }` slot, plus TypeScript interfaces describing what the host
adapter must provide. It never imports Pi types; the host passes primitives.
*Alternatives considered*: (a) shipping the full Pi adapter (input hook +
`sendUserMessage`) in utils — rejected, it would force a pi-coding-agent
dependency and couple utils to one plugin's runtime shape; (b) a bare helper
function with no state — rejected, the re-entrancy guard and single-slot
invariant need owned state to be testable and correct.

**Decision 2: Re-issue keyed on exact text match for the re-entrancy guard.**
The guard passes an input through only when its text equals the captured,
already-re-issued takeover, then clears the slot. *Rationale*: `sendUserMessage`
delivers with `source: "extension"`, but the re-issued text re-enters the
plugin's own input hook, and text equality is the only signal available without
Pi cooperation. *Alternative considered*: tagging the re-issued message via
`sendMessage` with a custom `customType` — rejected, it would not produce a
genuine `user`-role turn (the e2e asserts a `user` message_start exactly once)
and would change what the model sees.

**Decision 3: Host decides capture; the module only records it.**
Whether an input "preempts an active hidden run" depends on plugin state
(active decision, ownership, submission) the module must not know. The module
exposes `capture(text)` (called only when the host has decided to swallow),
`isReissuedTakeover(text)` / `clear()` for the guard, and
`takeForReissue()` returning the text once or `null`. *Alternative considered*:
pushing the ownership predicate into the module — rejected, it is
plugin-specific (decision vs reflection protocol) and would leak plugin
concerns into the shared library.

## Risks / Trade-offs

- [Text-equality guard could misfire if the user genuinely retypes the identical
  message while a re-issue is pending] → The slot is cleared on first match and
  the window is a single settle cycle; the verified e2e shows no false pass in
  practice. Document the limitation in the module's doc comment.
- [Re-issued turn appears with `source: "extension"` rather than the original
  interactive/rpc source] → Acceptable: the model receives the text as a real
  user turn, which is the contract that matters; the host plugin can log the
  provenance. The e2e confirms the model request still carries role `user`.
- [Single pending slot drops a second takeover arriving before the first
  settles] → Document that the host must settle or supersede before capturing
  again; pi-continue-watchdog's flow captures at most one takeover per preempted
  decision, so this matches the real consumer.
- [Host adapters in two plugins could diverge] → Mitigated by keeping the
  module the single owner of the state invariants and publishing a short usage
  example in the module doc comment.

## Migration Plan

Additive export only; no existing API changes. Release as a minor version bump
of pi-extension-utils. pi-continue-watchdog consumes the new version in a
separate change (replace its local `pendingTakeover` implementation with this
module, keep its input-hook/abort/`sendUserMessage` adapter), then rebases its
pi-coding-agent/pi-tui 0.85.1 bump PRs. Rollback: revert the version bump and
the new files; no consumer depends on them until the follow-up lands.

## Open Questions

None. The re-issue channel (`sendUserMessage`), the guard semantics, and
two-version compatibility were all verified empirically before this design.
