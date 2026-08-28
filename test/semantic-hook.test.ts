import { describe, expect, it, vi } from "vitest";

import {
	parseSemanticHook,
	publishSemanticHook,
	SEMANTIC_HOOK_CHANNEL,
	subscribeSemanticHooks,
} from "../src/semantic-hook.js";

const MAX_VALUES_VALUE_LENGTH = 4_096;
const MAX_DIAGNOSTIC_SNIPPET = 120;

function createBus() {
	const listeners = new Map<string, Set<(data: unknown) => void>>();
	return {
		on(channel: string, listener: (data: unknown) => void) {
			const channelListeners = listeners.get(channel) ?? new Set();
			channelListeners.add(listener);
			listeners.set(channel, channelListeners);
			return () => channelListeners.delete(listener);
		},
		emit(channel: string, data: unknown) {
			for (const listener of listeners.get(channel) ?? []) listener(data);
		},
	};
}

describe("semantic-hook protocol", () => {
	it("parses plain protocol data into immutable independent copies", () => {
		const values = { RESULT: "SUCCESS" };
		const input = {
			version: 1,
			name: "build-finished",
			values,
			extra: "ignored",
		};
		const result = parseSemanticHook(input);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.reason);
		expect(result.envelope).toEqual({
			version: 1,
			name: "build-finished",
			values: { RESULT: "SUCCESS" },
		});
		expect(Object.isFrozen(result.envelope)).toBe(true);
		expect(Object.isFrozen(result.envelope.values)).toBe(true);
		values.RESULT = "MUTATED";
		input.name = "mutated";
		expect(result.envelope).toEqual({
			version: 1,
			name: "build-finished",
			values: { RESULT: "SUCCESS" },
		});

		const nullPrototype = Object.assign(Object.create(null), {
			version: 1,
			name: "constructor",
			values: Object.assign(Object.create(null), { OK: "yes" }),
		});
		expect(parseSemanticHook(nullPrototype)).toMatchObject({ ok: true });
	});

	it("rejects malformed, inherited, custom-prototype, accessor, and oversized data", () => {
		class Envelope {
			version = 1;
			name = "valid-name";
		}
		const inherited = Object.create({ version: 1, name: "valid-name" });
		const accessor = Object.create(null);
		Object.defineProperty(accessor, "version", {
			enumerable: true,
			get: () => 1,
		});
		Object.defineProperty(accessor, "name", {
			enumerable: true,
			value: "valid-name",
		});
		const valueAccessor = Object.create(null);
		Object.defineProperty(valueAccessor, "OK", {
			enumerable: true,
			get: () => "yes",
		});
		const throwingPrototype = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw new Error("x".repeat(1_000));
				},
			},
		);

		for (const input of [
			null,
			[],
			throwingPrototype,
			new Envelope(),
			inherited,
			accessor,
			{ version: 2, name: "valid-name" },
			{ version: 1, name: "Bad_Name" },
			{ version: 1, name: "a".repeat(129) },
			{ version: 1, name: "valid-name", values: [] },
			{ version: 1, name: "valid-name", values: { badKey: "x" } },
			{ version: 1, name: "valid-name", values: { OK: 1 } },
			{
				version: 1,
				name: "valid-name",
				values: { OK: "x".repeat(MAX_VALUES_VALUE_LENGTH + 1) },
			},
			{ version: 1, name: "valid-name", values: valueAccessor },
		]) {
			const result = parseSemanticHook(input);
			expect(result.ok).toBe(false);
			if (!result.ok)
				expect(result.reason.length).toBeLessThanOrEqual(
					"envelope inaccessible: ".length + MAX_DIAGNOSTIC_SNIPPET + 1,
				);
		}
	});

	it("contains thrown values whose string conversion is itself hostile", () => {
		const unprintable = Object.create(null);
		Object.defineProperty(unprintable, "toString", {
			value() {
				throw new Error("stringification escaped");
			},
		});
		const hostileEnvelope = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw unprintable;
				},
			},
		);
		const parsed = parseSemanticHook(hostileEnvelope);
		expect(parsed).toEqual({
			ok: false,
			reason: "envelope inaccessible: unprintable error",
		});

		const hostileInput = new Proxy(Object.create(null), {
			getOwnPropertyDescriptor() {
				throw unprintable;
			},
		});
		expect(() => publishSemanticHook({ emit: vi.fn() }, hostileInput)).toThrow(
			new TypeError(
				"Invalid semantic hook: property access failed: unprintable error",
			),
		);
	});

	it("publishes one frozen validated envelope synchronously", () => {
		const emit = vi.fn();
		const values = { RESULT: "SUCCESS" };
		const envelope = publishSemanticHook(
			{ emit },
			{ name: "build-finished", values },
		);
		expect(emit).toHaveBeenCalledOnce();
		expect(emit).toHaveBeenCalledWith(SEMANTIC_HOOK_CHANNEL, envelope);
		expect(envelope).toEqual({
			version: 1,
			name: "build-finished",
			values: { RESULT: "SUCCESS" },
		});
		expect(Object.isFrozen(envelope)).toBe(true);
		expect(Object.isFrozen(envelope.values)).toBe(true);
		values.RESULT = "MUTATED";
		expect(envelope.values?.RESULT).toBe("SUCCESS");
	});

	it("publisher rejects invalid producer data before emitting with bounded TypeError", () => {
		const emit = vi.fn();
		expect(() =>
			publishSemanticHook({ emit }, { name: "Bad_Name" }),
		).toThrow(TypeError);
		expect(emit).not.toHaveBeenCalled();

		const hostile = Object.create(null);
		Object.defineProperty(hostile, "name", {
			enumerable: true,
			get() {
				throw new Error("x".repeat(1_000));
			},
		});
		expect(() =>
			publishSemanticHook({ emit }, hostile),
		).toThrow(TypeError);
		try {
			publishSemanticHook({ emit }, hostile);
		} catch (error) {
			expect(String(error).length).toBeLessThanOrEqual(
				"TypeError: Invalid semantic hook: ".length +
					MAX_DIAGNOSTIC_SNIPPET +
					1,
			);
		}
	});

	it("subscriber delivers only frozen valid envelopes, reports invalid, and unsubscribes", () => {
		const bus = createBus();
		const received: unknown[] = [];
		const invalid: string[] = [];
		const unsubscribe = subscribeSemanticHooks(
			bus,
			(envelope) => received.push(envelope),
			(reason) => invalid.push(reason),
		);

		bus.emit(SEMANTIC_HOOK_CHANNEL, {
			version: 1,
			name: "build-finished",
			values: { RESULT: "SUCCESS" },
		});
		bus.emit(SEMANTIC_HOOK_CHANNEL, {
			version: 1,
			name: "Bad_Name",
		});
		expect(received).toHaveLength(1);
		expect(Object.isFrozen(received[0])).toBe(true);
		expect(invalid).toEqual(["name must be lowercase kebab-case"]);

		unsubscribe();
		bus.emit(SEMANTIC_HOOK_CHANNEL, {
			version: 1,
			name: "after-unsubscribe",
		});
		expect(received).toHaveLength(1);
	});
});
