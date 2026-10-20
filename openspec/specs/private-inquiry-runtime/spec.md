# private-inquiry-runtime Specification

## Purpose

Provide one reusable private inquiry execution contract for Pi extensions, separating full-fork and file-result mechanics from consumer verdicts, scheduling and publication policy.

## Requirements

### Requirement: Private execution is independently imported and registered nowhere publicly
The shared package SHALL expose a separately imported private inquiry entry point without initializing it from existing entry points. Creating a private operation SHALL NOT register public result functions, subagent tools, commands, RPC/delegation bridges or agent catalogs. The child SHALL load only required execution hooks, not ambient extension factories, skills or context files. Required provider registrations SHALL be inherited without reloading their extension factories. Independent public subagents and same-named foreign tools SHALL remain unchanged. Isolation SHALL NOT be represented as an OS sandbox against trusted same-process code.

#### Scenario: Existing utility consumer imports the package
- **WHEN** a consumer imports an existing utility entry point without opening a private inquiry
- **THEN** no Pi runtime or private runner is initialized and no extension surface is registered

#### Scenario: Public subagents is independently installed
- **WHEN** both watchdogs and an independently installed public subagent extension are loaded
- **THEN** private execution works without replacing public registration, consulting public agent profiles or registering duplicate tools

### Requirement: Each owned session inherits a complete effective fork
An operation SHALL create a distinct private child from the consumer-qualified parent session and active source branch. The child SHALL inherit the parent's selected provider/model/thinking and full effective conversation, system state and declarations under native compaction, exclusions and compatibility rules. Consumer legacy-context projection SHALL remain possible without substituting a suffix or fresh conversation. Instructions and supplements SHALL follow inherited context. Unavailable full-fork state SHALL produce a typed setup failure, never an alternate model or silent fresh/pruned fallback. Declarations SHALL NOT grant execution permission. No byte-identical provider payload or cache-hit guarantee is implied.

#### Scenario: Parent uses a non-default model after compaction
- **WHEN** a qualified parent uses a non-default model and retained native summary
- **THEN** its distinct child uses that selected model/thinking and eligible summary/active ancestry without sibling or excluded material

#### Scenario: A full fork cannot be constructed
- **WHEN** required source or compatible system state is unavailable
- **THEN** setup fails visibly without inventing a result or consuming a format attempt

### Requirement: The designated regular file is the only result transport
The host SHALL allocate an operation-owned private temporary result location and initialize the regular result file to `{}` before each terminal result attempt. Prior admitted writes SHALL settle before reset or reuse. A candidate SHALL come only from one complete JSON object read after the current attempt's own normally completed assistant response and admitted write. Inherited responses, stale files, prose, stdout, tool-result text, function arguments and alternative paths SHALL NOT supply or repair a result. File operations SHALL reject symlink/non-regular replacements using no-follow descriptor checks. Filesystem/setup errors SHALL remain typed execution failures. Temporary files SHALL grant no restart authority or durability claim.

#### Scenario: A previous response wrote a valid object
- **WHEN** the next authorized result attempt starts
- **THEN** its file is reset after prior writes settle and the old object cannot become the new result

#### Scenario: Assistant only prints JSON
- **WHEN** a normally completed terminal response leaves the file as `{}` and prints valid-looking JSON
- **THEN** file validation rejects the attempt without accepting the printed object

#### Scenario: The result target is replaced by a link
- **WHEN** the result path resolves to a symbolic link or non-regular file
- **THEN** the target is not followed and the operation fails as execution rather than asking the model to repair host storage

### Requirement: Execution distinguishes result-only and bounded-helper profiles
The caller SHALL select either designated-result-write-only execution or an explicitly admitted helper profile. Neither profile SHALL inherit arbitrary execution permission from parent declarations. A response containing a result write SHALL contain exactly that one admitted write and SHALL execute no helper or unrelated effect. Mixed, duplicate, unknown and alternate-path requests SHALL be rejected before any batch effect. The helper profile SHALL enforce a shared ten-call execution allowance across the logical inquiry's corrections. A helper-only response with admitted calls SHALL be allowed to continue privately without treating its untouched file as a missing terminal result. Result writes SHALL remain available after helper exhaustion and SHALL spend no helper budget. There SHALL be no ambient extension loading or uncontrolled delegation fallback to obtain helper execution.

#### Scenario: Continue selects result-only execution
- **WHEN** the model requests a helper or another tool instead of its designated result write
- **THEN** no such effect executes and the response enters bounded invalid-result handling

#### Scenario: Reflect researches before submitting
- **WHEN** admitted helper-only responses execute up to ten calls and then a valid result write is requested alone
- **THEN** helper responses are not charged as missing results and the result can still be submitted

#### Scenario: A mixed helper and result batch is emitted
- **WHEN** one response requests both a helper and a result write
- **THEN** neither effect runs and that invalid response does not spend helper execution budget

#### Scenario: An eleventh helper is requested
- **WHEN** the helper allowance is exhausted
- **THEN** another helper cannot execute and denial cannot start an unbounded native tool-error follow-up loop

### Requirement: Format correction is bounded within the same child
Each inquiry SHALL allow at most three consumed terminal result attempts, with safe concrete validator feedback, reset and correction inside the original child. Each terminal attempt SHALL stop after its one completed response and admitted write, without a post-write acknowledgement response. Text-only terminal responses and rejected batches SHALL remain bounded invalid attempts; helper-only progress SHALL spend helper allowance instead of silently creating unlimited responses. Provider transport retries SHALL NOT be advertised as format attempts or guaranteed single HTTP requests. A consumer-authorized follow-up inquiry SHALL reuse the same child; consumer policy SHALL bound business follow-ups without the shared module performing review or choosing verdicts.

#### Scenario: Invalid fields become valid
- **WHEN** the first terminal result is invalid and the next authorized response writes a valid object after concrete feedback
- **THEN** the child identity is unchanged and the caller receives no intermediate valid handoff

#### Scenario: Three terminal attempts are invalid
- **WHEN** an inquiry consumes three invalid terminal results
- **THEN** it returns one exhausted-result outcome without a fourth result request

#### Scenario: The consumer authorizes reconsideration
- **WHEN** a consumer permits a second inquiry after its own review policy
- **THEN** that inquiry reuses the child without the shared module selecting an action or resetting consumer business limits

### Requirement: Consumer validation and terminal failures remain separate
Payload validation and normalization SHALL be supplied by the consumer, not a shared watchdog action schema. The Interface SHALL distinguish accepted typed results, exhausted invalid results, cancellation/staleness and setup/provider/filesystem failures. Only normally completed own responses SHALL be validated. Provider errors and aborted outcomes SHALL NOT consume format or helper execution budget merely by occurring; admitted helper effects remain charged for actual execution. Supported native provider retry eligibility SHALL follow the consumer profile rather than a hard-coded global retry choice. Optional audit observations SHALL neither mutate accepted results nor add model calls, charge budgets or gate execution when they fail.

#### Scenario: Two consumers use different payloads
- **WHEN** Continue supplies its action/reason validator and Reflect supplies its five-field validator
- **THEN** each receives its own typed accepted result without importing the other's policy or normalization

#### Scenario: Provider execution fails
- **WHEN** an own response ends with an authoritative provider error rather than a normal result
- **THEN** that failure follows the configured native retry or typed execution-failure path, not a missing-field correction

#### Scenario: Optional audit fails
- **WHEN** a safe observation callback throws or attempts to mutate its supplied candidate
- **THEN** the accepted result and execution/format accounting remain unchanged

### Requirement: Cancellation revokes exact-child authority before draining work
An abort or false currentness guard SHALL revoke the operation's result, retry and publication authority before awaiting exact-child cancellation. The shared module SHALL drain or quarantine admitted work before file reset/reuse/removal, clean only its own resources and make repeated cancellation/disposal harmless. It SHALL never abort an unrelated parent run. Late responses, helper completions and files SHALL remain inert. Completed external effects SHALL NOT be represented as rolled back. Source qualification, native scheduling, durable receipts and outcome publication SHALL remain consumer-owned.

#### Scenario: Cancellation races a write
- **WHEN** cancellation occurs while an admitted write is in flight
- **THEN** authority is already revoked, cleanup waits or quarantines that writer, and its late file cannot authorize another attempt

#### Scenario: Another watchdog has live work
- **WHEN** one consumer cancels its private operation while another consumer or ordinary parent is running
- **THEN** only the owned child is cancelled and other work remains unaffected

### Requirement: New entry packaging preserves existing entry behavior
The single shared package SHALL deliver the private runtime and required pinned patch through clean Git and packed installations without developer-checkout imports, global mutation, shared-cache inode mutation or public plugin installation. Only the private entry SHALL require supported Pi >=1.3.0 host capabilities. Existing utility entry points SHALL retain their supported behavior and portable-host contracts without importing Pi execution. Package installation dependency growth SHALL be documented accurately; isolated loading SHALL NOT be described as zero installation dependencies. Installed execution SHALL use the compatible host SDK identity rather than a bundled second host.

#### Scenario: Clean installed watchdog loads the private entry
- **WHEN** a production-only Git or packed consumer is installed without a public subagent plugin
- **THEN** the private runtime is usable from installed assets and host SDK identity is preserved

#### Scenario: Existing portable utility consumer is verified
- **WHEN** supported existing utility acceptance cases run on Node.js, Bun and Deno
- **THEN** their previous contracts remain valid and no private Pi execution is initialized by their imports
