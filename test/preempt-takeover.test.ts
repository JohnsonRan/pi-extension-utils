import { describe, expect, it } from "vitest";

import { PreemptTakeover } from "../src/preempt-takeover.js";

describe("PreemptTakeover", () => {
	it("captures a preempting input and holds it pending", () => {
		const t = new PreemptTakeover();
		expect(t.hasPending).toBe(false);
		t.capture("user takeover");
		expect(t.hasPending).toBe(true);
	});

	it("does not offer a takeover for re-issue before it is taken", () => {
		const t = new PreemptTakeover();
		// Nothing captured: nothing to re-issue.
		expect(t.takeForReissue()).toBeNull();
	});

	it("re-issues the captured text exactly once with byte-for-byte fidelity", () => {
		const t = new PreemptTakeover();
		const text = "  continue with café ☕ and\ttabs  ";
		t.capture(text);
		expect(t.takeForReissue()).toBe(text);
		// Second take: already re-issued.
		expect(t.takeForReissue()).toBeNull();
		// Slot still pending until the guard clears it.
		expect(t.hasPending).toBe(true);
	});

	it("lets the re-issued text pass through once and clears the slot", () => {
		const t = new PreemptTakeover();
		t.capture("user takeover");
		expect(t.takeForReissue()).toBe("user takeover");
		// The re-issued message re-enters the input hook.
		expect(t.isReissuedTakeover("user takeover")).toBe(true);
		expect(t.hasPending).toBe(false);
		// Guard consumed: the same text no longer matches.
		expect(t.isReissuedTakeover("user takeover")).toBe(false);
	});

	it("does not pass through a takeover that was captured but not yet re-issued", () => {
		const t = new PreemptTakeover();
		t.capture("user takeover");
		// Guard only fires after takeForReissue marks it re-issued.
		expect(t.isReissuedTakeover("user takeover")).toBe(false);
		expect(t.hasPending).toBe(true);
	});

	it("does not clear the slot for a non-matching input while re-issue is pending", () => {
		const t = new PreemptTakeover();
		t.capture("user takeover");
		t.takeForReissue();
		expect(t.isReissuedTakeover("something else")).toBe(false);
		expect(t.hasPending).toBe(true);
		// The pending re-issued takeover still passes later.
		expect(t.isReissuedTakeover("user takeover")).toBe(true);
		expect(t.hasPending).toBe(false);
	});

	it("clear() drops a pending takeover and resets state", () => {
		const t = new PreemptTakeover();
		t.capture("user takeover");
		t.clear();
		expect(t.hasPending).toBe(false);
		expect(t.takeForReissue()).toBeNull();
		expect(t.isReissuedTakeover("user takeover")).toBe(false);
		// Behaves as freshly constructed: can capture again.
		t.capture("next");
		expect(t.takeForReissue()).toBe("next");
	});

	it("rejects a second capture while one is pending (single-slot invariant)", () => {
		const t = new PreemptTakeover();
		t.capture("first");
		expect(() => t.capture("second")).toThrow(/already pending/);
		// The original is preserved, not overwritten.
		expect(t.takeForReissue()).toBe("first");
	});
});
