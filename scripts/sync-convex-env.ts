import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const convexRuntimeVariables = [
	"ALFRED_NOTIFY_SECRET",
	"ALFRED_NOTIFY_USER_EMAIL",
] as const;

const missing = convexRuntimeVariables.filter((name) => !process.env[name]);
if (missing.length > 0) {
	throw new Error(
		`Faltan variables de runtime de Convex: ${missing.join(", ")}.`,
	);
}

const directory = mkdtempSync(join(tmpdir(), "library-convex-env-"));
const envFile = join(directory, ".env");
const envContents = convexRuntimeVariables
	.map((name) => `${name}=${JSON.stringify(process.env[name])}`)
	.join("\n");

writeFileSync(envFile, `${envContents}\n`, { mode: 0o600 });

try {
	const child = Bun.spawn(
		["bunx", "convex", "env", "set", "--force", "--from-file", envFile],
		{ stderr: "inherit", stdout: "inherit" },
	);
	const exitCode = await child.exited;
	if (exitCode !== 0) process.exit(exitCode);
} finally {
	rmSync(directory, { force: true, recursive: true });
}
