import { describe, expect, it } from "vitest";
import { parseReadingSidecars } from "./sidecars";

describe("parseReadingSidecars", () => {
	it("normaliza el progreso de varios dispositivos sin perder revisiones", () => {
		const result = parseReadingSidecars({
			sourceKey: "books/el-mom-test.epub",
			title: "El Mom Test",
			format: "epub",
			progress: {
				entries: {
					kindle: {
						device_id: "kindle-id",
						label: "Kindle",
						file: "/mnt/us/books/El Mom Test.epub",
						page: 109,
						percent: 0.56,
						total_pages: 192,
						timestamp: 1784440638,
						revision: 14,
					},
					linux: {
						device_id: "linux-id",
						label: "Linux",
						file: "/home/vrivera/Books/El Mom Test.epub",
						page: 92,
						percent: 0.53,
						total_pages: 171,
						timestamp: 1784435221,
						revision: 2,
					},
				},
			},
			annotations: { annotations: {} },
		});

		expect(result.document).toMatchObject({
			sourceKey: "books/el-mom-test.epub",
			title: "El Mom Test",
			format: "epub",
		});
		expect(result.progress).toEqual([
			expect.objectContaining({ deviceId: "kindle-id", page: 109 }),
			expect.objectContaining({ deviceId: "linux-id", page: 92 }),
		]);
	});

	it("conserva la ubicación y la nota opcional de una anotación", () => {
		const result = parseReadingSidecars({
			sourceKey: "books/el-mom-test.epub",
			title: "El Mom Test",
			format: "epub",
			progress: { entries: {} },
			annotations: {
				annotations: {
					"locator||locator-end": {
						text: "Una idea importante.",
						note: "Conectarlo con Library.",
						chapter: "Capítulo 1",
						color: "gray",
						page: "locator",
						pageno: 12,
						pos0: "locator",
						pos1: "locator-end",
						datetime: "2026-07-16 15:30:16",
						device_id: "linux-id",
						device_label: "Linux",
					},
				},
			},
		});

		expect(result.annotations).toEqual([
			{
				sourceKey: "locator||locator-end",
				text: "Una idea importante.",
				note: "Conectarlo con Library.",
				chapter: "Capítulo 1",
				color: "gray",
				page: "locator",
				pageNumber: 12,
				positionStart: "locator",
				positionEnd: "locator-end",
				capturedAt: "2026-07-16 15:30:16",
				deviceId: "linux-id",
				deviceLabel: "Linux",
			},
		]);
	});

	it("descarta anotaciones sin texto y acepta sidecars ausentes", () => {
		const result = parseReadingSidecars({
			sourceKey: "books/empty.epub",
			title: "Empty",
			format: "epub",
			progress: undefined,
			annotations: {
				annotations: {
					bookmark: { text: "   " },
					valid: { text: "  Texto válido  " },
				},
			},
		});

		expect(result.progress).toEqual([]);
		expect(result.annotations).toEqual([
			expect.objectContaining({ sourceKey: "valid", text: "Texto válido" }),
		]);
	});
});
