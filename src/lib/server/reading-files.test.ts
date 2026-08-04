import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanReadingBooks } from "./reading-files";

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
});
