import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanReadingBooks, scanReadingBooksDetailed } from "./reading-files";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("scanReadingBooks", () => {
	it("ignora los sidecars antiguos de Syncery", async () => {
		const root = await mkdtemp(join(tmpdir(), "library-reading-"));
		temporaryRoots.push(root);
		const sidecarDirectory = join(root, "El Mom Test.sdr");
		await mkdir(sidecarDirectory);
		await writeFile(join(root, "El Mom Test.epub"), "book");
		await writeFile(
			join(sidecarDirectory, "El Mom Test.epub.syncery-progress.json"),
			JSON.stringify({
				entries: { linux: { device_id: "linux", percent: 0.42 } },
			}),
		);
		await writeFile(
			join(sidecarDirectory, "El Mom Test.epub.syncery-annotations.json"),
			JSON.stringify({
				annotations: {
					locator: { text: "Una idea.", note: "Volver a ella." },
				},
			}),
		);

		const [book] = await scanReadingBooks(root);

		expect(book).toMatchObject({
			title: "El Mom Test",
			sourcePath: "El Mom Test.epub",
			progress: [],
			annotations: [],
		});
	});

	it("importa el sidecar nativo metadata.epub.lua de KOReader", async () => {
		const root = await mkdtemp(join(tmpdir(), "library-reading-koreader-"));
		temporaryRoots.push(root);
		const sidecarDirectory = join(root, "Persona normal.sdr");
		await mkdir(sidecarDirectory);
		await writeFile(join(root, "Persona normal.epub"), "book");
		await writeFile(
			join(sidecarDirectory, "metadata.epub.lua"),
			`return {
\t["doc_path"] = "/home/vrivera/Books/Persona normal.epub",
\t["percent_finished"] = 0.6164,
\t["last_xpointer"] = "/body/DocFragment[39]/body/p[21]/text().130",
\t["annotations"] = {
\t\t[1] = {
\t\t\t["text"] = "Una anotación nueva.",
\t\t\t["pos0"] = "/body/DocFragment[1]/body/p[1]/text().0",
\t\t\t["pos1"] = "/body/DocFragment[1]/body/p[1]/text().20",
\t\t},
\t},
}
`,
		);

		const [book] = await scanReadingBooks(root);

		expect(book).toMatchObject({
			progress: [
				expect.objectContaining({
					deviceId: "koreader",
					percent: 0.6164,
					locator: "/body/DocFragment[39]/body/p[21]/text().130",
				}),
			],
			annotations: [
				expect.objectContaining({
					text: "Una anotación nueva.",
					positionStart: "/body/DocFragment[1]/body/p[1]/text().0",
				}),
			],
		});
	});

	it("continúa con otros archivos cuando un sidecar está corrupto", async () => {
		const root = await mkdtemp(join(tmpdir(), "library-reading-partial-"));
		temporaryRoots.push(root);
		await mkdir(join(root, "Broken.sdr"));
		await mkdir(join(root, "Valid.sdr"));
		await writeFile(join(root, "Broken.epub"), "broken");
		await writeFile(join(root, "Valid.epub"), "valid");
		await writeFile(join(root, "Broken.sdr", "metadata.epub.lua"), "return {");
		await writeFile(
			join(root, "Valid.sdr", "metadata.epub.lua"),
			"return { percent_finished = 0.2 }",
		);

		const result = await scanReadingBooksDetailed(root, {
			stabilityWindowMs: 0,
		});

		expect(result.files).toHaveLength(1);
		expect(result.files[0]?.sourcePath).toBe("Valid.epub");
		expect(result.errors).toEqual([
			expect.objectContaining({ path: "Broken.epub" }),
		]);
	});

	it("omite una fuente sin cambios en una ejecución incremental", async () => {
		const root = await mkdtemp(join(tmpdir(), "library-reading-incremental-"));
		temporaryRoots.push(root);
		await writeFile(join(root, "Stable.epub"), "stable");

		const first = await scanReadingBooksDetailed(root, {
			stabilityWindowMs: 0,
		});
		const second = await scanReadingBooksDetailed(root, {
			stabilityWindowMs: 0,
			knownSources: [
				{
					sourceKey: "Stable.epub",
					fileModifiedAt: first.files[0]?.fileModifiedAt,
					sidecarModifiedAt: first.files[0]?.sidecarModifiedAt,
				},
			],
		});

		expect(second.files).toHaveLength(0);
		expect(second.skipped).toEqual(["Stable.epub"]);
	});
});
