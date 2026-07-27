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
	it("encuentra sidecars en la carpeta .sdr basada en el nombre del libro", async () => {
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
			progress: [{ deviceId: "linux", percent: 0.42 }],
			annotations: [
				{ sourceKey: "locator", text: "Una idea.", note: "Volver a ella." },
			],
		});
	});
});
