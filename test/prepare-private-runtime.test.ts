import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");

async function runScript(cwd: string) {
	return execFileAsync(process.execPath, [join(root, "scripts/prepare-private-runtime.mjs")], {
		cwd,
		env: cwd === root ? process.env : { ...process.env, PIU_PRIVATE_RUNTIME_ROOT: cwd },
	});
}

it("prepare-private-runtime patches the pinned runtime with the retry seam", async () => {
	const out = await runScript(root);
	expect(out.stderr).toMatch( /Prepared private pi-subagents 0.79.0 \(1008e5993e90fcf13b815c97c15a0c54f7f6f116\)/);
	// Entry loads through tsx from this package's node_modules.
	const check = await execFileAsync(process.execPath, [
		"--import",
		"tsx",
		join(root, "scripts/import-check.ts"),
	], { cwd: root });
	expect(check.stdout).toMatch( /private runtime entry loads: function/);
	// Idempotent: a second run succeeds and verifies hashes.
	await runScript(root);
});

it("prepare-private-runtime refuses a shared or linked runtime", async () => {
	const temp = await mkdtemp("/var/tmp/piu-prepare-refuse-");
	try {
	// A node_modules where the dependency is a symlink must be rejected.
	await import("node:fs/promises").then((fs) => fs.mkdir(join(temp, "node_modules"), { recursive: true }));
	await import("node:fs/promises").then((fs) =>
		fs.symlink(join(root, "node_modules/private-inquiry-subagents-runtime"), join(temp, "node_modules/private-inquiry-subagents-runtime")));
	await expect(runScript(temp)).rejects.toThrow(/Refusing to patch a shared or linked runtime/);
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
});
