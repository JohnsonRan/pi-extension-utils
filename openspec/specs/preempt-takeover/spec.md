# preempt-takeover Specification

## Purpose

Capture user input that preempts a plugin-owned hidden run so the host plugin
can re-issue it as a fresh user turn after the hidden run settles, guaranteeing
the user's message is never lost when the host aborts asynchronously.

## Requirements

### Requirement: Capture decision for preempting input

The state machine SHALL decide, for each user input event, whether the input
must be captured for later re-issue (because it preempts an active plugin-owned
hidden run) or allowed to pass through to the host unchanged. The state machine
MUST NOT itself perform Pi effects; it only returns a decision the host adapter
acts on (return `handled` from the input hook and abort the hidden run, or
return `continue`).

#### Scenario: Input preempts an active hidden run

- **WHEN** the host reports a user input while it owns an active hidden run and
  no takeover is currently captured
- **THEN** the state machine returns "capture" and records the input text as
  the pending takeover, marked not-yet-reissued

#### Scenario: Input does not preempt

- **WHEN** the host reports a user input while no plugin-owned hidden run is
  active, or the input fails the host's ownership criteria
- **THEN** the state machine returns "passthrough" and records nothing

### Requirement: Re-entrancy guard for re-issued takeover

After the host re-issues a captured takeover, the state machine SHALL let that
exact text pass through the input path untouched instead of capturing it again,
so the re-issued message becomes a genuine new user turn and cannot loop.

#### Scenario: Re-issued takeover arrives at the input hook

- **WHEN** a user input event matches the text of a captured takeover that the
  host has marked as re-issued
- **THEN** the state machine returns "passthrough" and clears the pending
  takeover so subsequent inputs are evaluated normally

#### Scenario: Different input while a re-issue is pending

- **WHEN** a user input event does not match the captured takeover text
- **THEN** the state machine evaluates it by the capture-decision requirement
  and MUST NOT clear the pending takeover

### Requirement: Re-issue decision once the host is idle

The state machine SHALL expose which captured takeover is ready to re-issue
when the host reports it has become idle after the preempted hidden run
settled. A takeover MUST be offered for re-issue at most once: once the host
takes it for re-issue, the state machine marks it re-issued and MUST NOT offer
it again.

#### Scenario: Idle host with a pending takeover

- **WHEN** the host reports idle and a takeover is captured that has not yet
  been re-issued
- **THEN** the state machine returns the takeover text exactly as captured and
  marks it re-issued

#### Scenario: Idle host without a pending takeover

- **WHEN** the host reports idle and no takeover is captured, or the captured
  takeover was already re-issued
- **THEN** the state machine reports nothing to re-issue

### Requirement: Text fidelity and single-slot semantics

The state machine SHALL preserve the takeover text exactly as captured (no
truncation, normalization, or decoration) and SHALL hold at most one pending
takeover at a time; the host is responsible for settling or superseding a
pending takeover before capturing another.

#### Scenario: Text preserved byte-for-byte

- **WHEN** a takeover is captured and later taken for re-issue
- **THEN** the returned text equals the captured input text exactly

#### Scenario: Reset between turns

- **WHEN** the host reports the preempted hidden run fully settled with no
  takeover to re-issue, or the host explicitly resets
- **THEN** the state machine holds no pending takeover and behaves as freshly
  constructed
