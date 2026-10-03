import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ConvexHttpClient } from "convex/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLibraryMcpServer } from "./library-mcp";

type ToolResult = { isError?: boolean; content: { text: string }[] };

describe("library MCP ideas", () => {
	let vault: string;
	let mutation: ReturnType<typeof vi.fn>;
	let client: Client;

	beforeEach(async () => {
		vault = await mkdtemp(join(tmpdir(), "library-mcp-"));
		mutation = vi.fn().mockResolvedValue("idea-id");
		const convex = { query: vi.fn(), mutation } as unknown as ConvexHttpClient;
		const server = createLibraryMcpServer(convex, vault);
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		client = new Client({ name: "test", version: "0.0.0" });
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
	});

	afterEach(async () => {
		await client.close();
		await rm(vault, { recursive: true, force: true });
	});

	async function call(name: string, args: Record<string, unknown>) {
		const response = (await client.callTool({
			name,
			arguments: args,
		})) as ToolResult;
		const text = response.content[0].text;
		return {
			isError: Boolean(response.isError),
			text,
			json: response.isError ? undefined : JSON.parse(text),
		};
	}

	it("crea la nota y la indexa en Convex", async () => {
		const created = await call("library_create_idea", {
			title: "Ideas sobre foco",
			content: "Una sola cosa a la vez.",
		});

		expect(created.json.relativePath).toBe(
			"100 - Knowledge/Ideas/ideas-sobre-foco.md",
		);
		const file = await readFile(join(vault, created.json.relativePath), "utf8");
		expect(file).toBe("# Ideas sobre foco\n\nUna sola cosa a la vez.");
		expect(mutation).toHaveBeenCalledTimes(1);
		expect(mutation.mock.calls[0][1].idea).toMatchObject({
			relativePath: created.json.relativePath,
			title: "Ideas sobre foco",
			contentHash: created.json.contentHash,
		});
	});

	it("edita con el hash vigente y vuelve a indexar", async () => {
		const created = await call("library_create_idea", { title: "Nota" });
		mutation.mockClear();

		const updated = await call("library_update_idea", {
			relativePath: created.json.relativePath,
			content: "# Nota\n\nNuevo texto.",
			contentHash: created.json.contentHash,
		});

		expect(updated.json.conflict).toBe(false);
		expect(updated.json.contentHash).not.toBe(created.json.contentHash);
		const read = await call("library_read_idea", {
			relativePath: created.json.relativePath,
		});
		expect(read.json.content).toBe("# Nota\n\nNuevo texto.");
		expect(mutation).toHaveBeenCalledTimes(1);
	});

	it("rechaza la edición si la nota cambió y no escribe ni indexa", async () => {
		const created = await call("library_create_idea", { title: "Nota" });
		mutation.mockClear();
		// Cambio externo, por ejemplo desde Obsidian.
		await writeFile(
			join(vault, created.json.relativePath),
			"# Nota\n\nEditada en Obsidian.",
		);

		const attempt = await call("library_update_idea", {
			relativePath: created.json.relativePath,
			content: "# Nota\n\nReemplazo hecho por el agente.",
			contentHash: created.json.contentHash,
		});

		expect(attempt.json.conflict).toBe(true);
		expect(attempt.json.current.content).toBe("# Nota\n\nEditada en Obsidian.");
		expect(await readFile(join(vault, created.json.relativePath), "utf8")).toBe(
			"# Nota\n\nEditada en Obsidian.",
		);
		expect(mutation).not.toHaveBeenCalled();
	});

	it("no permite leer ni escribir fuera de la carpeta de ideas", async () => {
		await writeFile(join(vault, "secreto.md"), "# Privado");

		const read = await call("library_read_idea", {
			relativePath: "../../secreto.md",
		});
		const write = await call("library_update_idea", {
			relativePath: "secreto.md",
			content: "# Pisado",
			contentHash: "x",
		});

		expect(read.isError).toBe(true);
		expect(write.isError).toBe(true);
		expect(await readFile(join(vault, "secreto.md"), "utf8")).toBe("# Privado");
	});
});
