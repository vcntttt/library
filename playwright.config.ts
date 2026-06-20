import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

loadLocalEnv();

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const shouldStartLocalServer = !process.env.E2E_BASE_URL;

function loadLocalEnv() {
	if (!existsSync(".env.local")) return;

	const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex === -1) continue;

		const key = trimmed.slice(0, separatorIndex).trim();
		if (!key || process.env[key] !== undefined) continue;

		const rawValue = trimmed.slice(separatorIndex + 1).trim();
		process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
	}
}

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	fullyParallel: false,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["html"], ["list"]],
	use: {
		baseURL,
		locale: "es-CL",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: shouldStartLocalServer
		? {
				command: "E2E=1 bun run dev:web -- --port 3100 --strictPort",
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
				stdout: "pipe",
				stderr: "pipe",
			}
		: undefined,
});
