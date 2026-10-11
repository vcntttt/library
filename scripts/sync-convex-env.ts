import { spawnSync } from "node:child_process";
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
	const child = spawnSync(
		"bunx",
		["convex", "env", "set", "--force", "--from-file", envFile],
		{ stdio: "inherit" },
	);
	if (child.error) throw child.error;
	// No usar process.exit aquí: cortaría el proceso antes del finally y el
	// archivo temporal con secretos quedaría en disco.
	process.exitCode = child.status ?? 1;
} finally {
	rmSync(directory, { force: true, recursive: true });
}
