import { describe, expect, it } from "vitest";
import {
	buildAnnotationIdentity,
	normalizeHighlightText,
	selectCanonicalProgress,
} from "./reconciliation";

describe("reading reconciliation", () => {
	it("prefiere posiciones y fecha antes que el índice nativo", () => {
		expect(
			buildAnnotationIdentity(
				{
					text: " Una idea importante. ",
					positionStart: "p1",
					positionEnd: "p2",
					capturedAt: "2026-08-08 10:00:00",
				},
				4,
			),
		).toBe("position:p1|p2|2026-08-08 10:00:00");

		expect(buildAnnotationIdentity({ text: "Una idea" }, 4)).toBe(
			"index:4|text:una idea",
		);
	});

	it("normaliza whitespace y acentos para detectar texto parecido", () => {
		expect(normalizeHighlightText("  Una\n  idea importante. ")).toBe(
			"una idea importante.",
		);
		expect(normalizeHighlightText("acción")).toBe("accion");
	});

	it("muestra el máximo alcanzado y usa la fuente más reciente como actual", () => {
		const result = selectCanonicalProgress([
			{
				percent: 0.82,
				maxPercent: 0.82,
				sourceTimestamp: 100,
				revision: 4,
				completionStatus: "in-progress",
			},
			{
				percent: 0.41,
				maxPercent: 0.7,
				sourceTimestamp: 200,
				revision: 2,
				completionStatus: "complete",
			},
		]);

		expect(result.currentPercent).toBe(0.41);
		expect(result.maxPercent).toBe(0.82);
		expect(result.completionStatus).toBe("complete");
	});
});
