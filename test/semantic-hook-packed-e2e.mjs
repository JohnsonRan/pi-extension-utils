import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
	createEventBus,
	createExtensionRuntime,
	discoverAndLoadExtensions,
	ExtensionRunner,
} from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function bindRunner(runner) {
	runner.bindCore(
		{
			sendMessage() {},
			sendUserMessage() {},
			appendEntry() {},
			setSessionName() {},
			getSessionName() {},
			setLabel() {},
			getActiveTools: () => [],
			getAllTools: () => [],
			setActiveTools() {},
			refreshTools() {},
			getCommands: () => [],
			setModel: async () => true,
			getThinkingLevel: () => "off",
			setThinkingLevel() {},
		},
		{
			getModel: () => undefined,
			getScopedModels: () => [],
			isIdle: () => true,
			isProjectTrusted: () => true,
			getSignal: () => undefined,
			abort() {},
			hasPendingMessages: () => false,
			shutdown() {},
			getContextUsage: () => undefined,
			compact() {},
			getSystemPrompt: () => "",
		},
	);
}

const root = await mkdtemp(join(tmpdir(), "pi-extension-utils-semantic-hook-"));
// npm is npm.cmd on Windows, which execFile cannot start; run npm's own CLI script via node.
const npm = (args, options) =>
	process.env.npm_execpath
		? execFileAsync(process.execPath, [process.env.npm_execpath, ...args], options)
		: execFileAsync("npm", args, options);

try {
	const packDir = join(root, "pack");
	const installRoot = join(root, "install");
	const agentDir = join(root, "agent");
	const cwd = join(root, "project");
	await Promise.all([
		mkdir(packDir, { recursive: true }),
		mkdir(installRoot, { recursive: true }),
		mkdir(agentDir, { recursive: true }),
		mkdir(cwd, { recursive: true }),
	]);

	await npm(["run", "build:dist"], {
		cwd: repoRoot,
		timeout: 120_000,
	});
	const { stdout } = await npm(
		["pack", "--json", "--pack-destination", packDir],
		{ cwd: repoRoot, timeout: 120_000, maxBuffer: 1024 * 1024 },
	);
	const packed = JSON.parse(stdout);
	assert.equal(packed.length, 1);
	const tarball = join(packDir, packed[0].filename);
	await npm(["init", "-y"], {
		cwd: installRoot,
		timeout: 30_000,
	});
	await npm(
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			tarball,
		],
		{ cwd: installRoot, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
	);
	const packageDir = join(
		installRoot,
		"node_modules",
		"pi-extension-utils",
	);
	const packageJson = JSON.parse(
		await readFile(join(packageDir, "package.json"), "utf8"),
	);
	assert.ok(packageJson.exports["./semantic-hook"]);

	const markerPath = join(root, "markers.jsonl");
	const producerPath = join(installRoot, "producer.mjs");
	const consumerPath = join(installRoot, "consumer.mjs");
	await writeFile(
		producerPath,
		`import { publishSemanticHook } from "pi-extension-utils/semantic-hook";
export default function registerProducer(pi) {
  pi.on("session_start", () => {
    pi.events.emit("pi:semantic-hook:v1", {
      version: 1,
      name: "raw-to-shared",
      values: { DIRECTION: "RAW_PRODUCER" },
    });
    pi.events.emit("pi:semantic-hook:v1", {
      version: 1,
      name: "Bad_Name",
    });
    publishSemanticHook(pi.events, {
      name: "shared-to-raw",
      values: { DIRECTION: "SHARED_PRODUCER" },
    });
  });
}
`,
	);
	await writeFile(
		consumerPath,
		`import { appendFileSync } from "node:fs";
import { subscribeSemanticHooks } from "pi-extension-utils/semantic-hook";
const marker = ${JSON.stringify(markerPath)};
const write = (value) => appendFileSync(marker, JSON.stringify(value) + "\\n");
export default function registerConsumer(pi) {
  let unsubscribe;
  pi.events.on("pi:semantic-hook:v1", (data) => {
    if (data && data.version === 1 && data.name === "shared-to-raw") {
      write({ kind: "raw-consumer", envelope: data, frozen: Object.isFrozen(data), valuesFrozen: Object.isFrozen(data.values) });
    }
  });
  pi.on("session_start", () => {
    unsubscribe = subscribeSemanticHooks(
      pi.events,
      (envelope) => write({ kind: "shared-consumer", envelope, frozen: Object.isFrozen(envelope), valuesFrozen: Object.isFrozen(envelope.values) }),
      (reason) => write({ kind: "invalid", reason }),
    );
  });
  pi.on("session_shutdown", () => {
    unsubscribe?.();
    unsubscribe = undefined;
  });
}
`,
	);

	const bus = createEventBus();
	const loaded = await discoverAndLoadExtensions(
		[consumerPath, producerPath],
		cwd,
		agentDir,
		bus,
	);
	assert.deepEqual(loaded.errors, []);
	assert.equal(loaded.extensions.length, 2);
	const runner = new ExtensionRunner(
		loaded.extensions,
		loaded.runtime ?? createExtensionRuntime(),
		cwd,
		{
			getSessionId: () => "semantic-hook-e2e",
			getSessionFile: () => undefined,
		},
		{},
	);
	bindRunner(runner);
	await runner.emit({ type: "session_start" });

	const rows = (await readFile(markerPath, "utf8"))
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	assert.deepEqual(
		rows.find((row) => row.kind === "shared-consumer"),
		{
			kind: "shared-consumer",
			envelope: {
				version: 1,
				name: "raw-to-shared",
				values: { DIRECTION: "RAW_PRODUCER" },
			},
			frozen: true,
			valuesFrozen: true,
		},
	);
	assert.deepEqual(
		rows.find((row) => row.kind === "raw-consumer"),
		{
			kind: "raw-consumer",
			envelope: {
				version: 1,
				name: "shared-to-raw",
				values: { DIRECTION: "SHARED_PRODUCER" },
			},
			frozen: true,
			valuesFrozen: true,
		},
	);
	const invalidRows = rows.filter((row) => row.kind === "invalid");
	assert.equal(invalidRows.length, 1);
	assert.match(invalidRows[0].reason, /lowercase kebab-case/);

	await runner.emit({ type: "session_shutdown", reason: "test" });
	bus.emit("pi:semantic-hook:v1", {
		version: 1,
		name: "after-shutdown",
	});
	const afterShutdown = (await readFile(markerPath, "utf8"))
		.trim()
		.split("\n");
	assert.equal(afterShutdown.length, rows.length);

	console.log(
		JSON.stringify({
			ok: true,
			packed: packed[0].filename,
			directions: ["raw-to-shared", "shared-to-raw"],
			malformedRejected: true,
			shutdownUnsubscribed: true,
		}),
	);
} finally {
	await rm(root, { recursive: true, force: true });
}
