export const SEMANTIC_HOOK_CHANNEL = "pi:semantic-hook:v1" as const;

/** Bounded protocol sizes keep validation and diagnostics proportionate. */
const MAX_HOOK_NAME_LENGTH = 128;
const MAX_VALUES_KEY_LENGTH = 128;
const MAX_VALUES_VALUE_LENGTH = 4_096;
const MAX_DIAGNOSTIC_SNIPPET = 120;

export interface SemanticHookV1 {
	readonly version: 1;
	readonly name: string;
	readonly values?: Readonly<Record<string, string>>;
}

export interface SemanticHookInput {
	readonly name: string;
	readonly values?: Readonly<Record<string, string>>;
}

export type ParseSemanticHookResult =
	| { ok: true; envelope: SemanticHookV1 }
	| { ok: false; reason: string };

/** Structural subset of Pi's shared EventBus. No Pi runtime import required. */
export interface SemanticHookEvents {
	emit(channel: string, data: unknown): void;
	on(channel: string, listener: (data: unknown) => void): () => void;
}

const KEBAB_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

function isSemanticHookName(name: string): boolean {
	return (
		name.length > 0 &&
		name.length <= MAX_HOOK_NAME_LENGTH &&
		KEBAB_NAME.test(name)
	);
}

function isSemanticHookValueKey(key: string): boolean {
	return (
		key.length > 0 &&
		key.length <= MAX_VALUES_KEY_LENGTH &&
		UPPER_SNAKE.test(key)
	);
}

/** Ordinary object or null-prototype record; rejects arrays and custom prototypes. */
function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value))
		return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function clipSemanticHookDiagnostic(text: string): string {
	if (text.length <= MAX_DIAGNOSTIC_SNIPPET) return text;
	return `${text.slice(0, MAX_DIAGNOSTIC_SNIPPET)}…`;
}

function describeThrown(value: unknown): string {
	try {
		return clipSemanticHookDiagnostic(
			value instanceof Error ? value.message : String(value),
		);
	} catch {
		return "unprintable error";
	}
}

/** Read one own data property without invoking accessors or inherited fields. */
function readOwnDataProperty(
	object: object,
	key: string,
): { ok: true; value: unknown } | { ok: false; reason: string } {
	try {
		if (!Object.hasOwn(object, key)) return { ok: false, reason: "missing" };
		const descriptor = Object.getOwnPropertyDescriptor(object, key);
		if (
			!descriptor ||
			"get" in descriptor ||
			"set" in descriptor ||
			!("value" in descriptor)
		) {
			return { ok: false, reason: "not a data property" };
		}
		return { ok: true, value: descriptor.value };
	} catch (error) {
		return {
			ok: false,
			reason: `property access failed: ${describeThrown(error)}`,
		};
	}
}

function freezeValues(
	values: Record<string, string>,
): Readonly<Record<string, string>> {
	return Object.freeze({ ...values });
}

/** Validate one envelope and return an immutable copy of accepted protocol data. */
function parseSemanticHookUnchecked(data: unknown): ParseSemanticHookResult {
	if (!isPlainObject(data)) {
		return { ok: false, reason: "envelope must be a plain object" };
	}

	const versionProp = readOwnDataProperty(data, "version");
	if (!versionProp.ok) {
		return {
			ok: false,
			reason:
				versionProp.reason === "missing"
					? "version must be exactly 1"
					: versionProp.reason,
		};
	}
	if (versionProp.value !== 1) {
		return { ok: false, reason: "version must be exactly 1" };
	}

	const nameProp = readOwnDataProperty(data, "name");
	if (!nameProp.ok) {
		return {
			ok: false,
			reason:
				nameProp.reason === "missing"
					? "name must be lowercase kebab-case"
					: nameProp.reason,
		};
	}
	if (
		typeof nameProp.value !== "string" ||
		!isSemanticHookName(nameProp.value)
	) {
		return { ok: false, reason: "name must be lowercase kebab-case" };
	}

	let values: Readonly<Record<string, string>> | undefined;
	if (Object.hasOwn(data, "values")) {
		const valuesProp = readOwnDataProperty(data, "values");
		if (!valuesProp.ok) return { ok: false, reason: valuesProp.reason };
		if (valuesProp.value === undefined) {
			// An own undefined data property is equivalent to absent optional values.
		} else if (!isPlainObject(valuesProp.value)) {
			return {
				ok: false,
				reason: "values must be a plain non-array object",
			};
		} else {
			const copied: Record<string, string> = Object.create(null);
			let keys: string[];
			try {
				keys = Object.keys(valuesProp.value);
			} catch (error) {
				return {
					ok: false,
					reason: `values keys inaccessible: ${describeThrown(error)}`,
				};
			}
			for (const key of keys) {
				if (!isSemanticHookValueKey(key)) {
					return {
						ok: false,
						reason: `invalid values key ${JSON.stringify(clipSemanticHookDiagnostic(key))}`,
					};
				}
				const entry = readOwnDataProperty(valuesProp.value, key);
				if (!entry.ok) {
					return {
						ok: false,
						reason: `values.${clipSemanticHookDiagnostic(key)}: ${entry.reason}`,
					};
				}
				if (typeof entry.value !== "string") {
					return {
						ok: false,
						reason: `values.${clipSemanticHookDiagnostic(key)} must be a string`,
					};
				}
				if (entry.value.length > MAX_VALUES_VALUE_LENGTH) {
					return {
						ok: false,
						reason: `values.${clipSemanticHookDiagnostic(key)} exceeds ${MAX_VALUES_VALUE_LENGTH} characters`,
					};
				}
				copied[key] = entry.value;
			}
			values = freezeValues(copied);
		}
	}

	const envelope: SemanticHookV1 =
		values === undefined
			? Object.freeze({ version: 1 as const, name: nameProp.value })
			: Object.freeze({ version: 1 as const, name: nameProp.value, values });
	return { ok: true, envelope };
}

/** Contain hostile Proxy traps as bounded validation failures. */
export function parseSemanticHook(data: unknown): ParseSemanticHookResult {
	try {
		return parseSemanticHookUnchecked(data);
	} catch (error) {
		return {
			ok: false,
			reason: `envelope inaccessible: ${describeThrown(error)}`,
		};
	}
}

/** Build, validate, freeze, and synchronously publish one semantic hook. */
export function publishSemanticHook(
	events: Pick<SemanticHookEvents, "emit">,
	input: SemanticHookInput,
): SemanticHookV1 {
	const candidate = Object.create(null) as Record<string, unknown>;
	candidate.version = 1;
	if (input !== null && typeof input === "object") {
		const name = readOwnDataProperty(input, "name");
		if (name.ok) candidate.name = name.value;
		else if (name.reason !== "missing") {
			throw new TypeError(
				`Invalid semantic hook: ${clipSemanticHookDiagnostic(name.reason)}`,
			);
		}
		const values = readOwnDataProperty(input, "values");
		if (values.ok) candidate.values = values.value;
		else if (values.reason !== "missing") {
			throw new TypeError(
				`Invalid semantic hook: ${clipSemanticHookDiagnostic(values.reason)}`,
			);
		}
	}
	const parsed = parseSemanticHook(candidate);
	if (!parsed.ok) {
		throw new TypeError(
			`Invalid semantic hook: ${clipSemanticHookDiagnostic(parsed.reason)}`,
		);
	}
	events.emit(SEMANTIC_HOOK_CHANNEL, parsed.envelope);
	return parsed.envelope;
}

/** Subscribe to valid hooks. Malformed payloads are reported but never delivered. */
export function subscribeSemanticHooks(
	events: Pick<SemanticHookEvents, "on">,
	listener: (envelope: SemanticHookV1) => void,
	onInvalid?: (reason: string) => void,
): () => void {
	return events.on(SEMANTIC_HOOK_CHANNEL, (data) => {
		const parsed = parseSemanticHook(data);
		if (parsed.ok) listener(parsed.envelope);
		else onInvalid?.(clipSemanticHookDiagnostic(parsed.reason));
	});
}
