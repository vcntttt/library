import { describe, expect, it } from "vitest";
import {
	buildAnnotationIdentity,
	compareProgressSource,
	matchAnnotationRows,
	normalizeHighlightText,
	selectCanonicalProgress,
	toEpochSeconds,
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

	it("no asigna dos anotaciones entrantes a la misma fila existente", () => {
		const rowA = {
			id: "a",
			sourceKey: "p1||p2",
			sourceFingerprint: "position:p1|p2|t1",
		};
		const incoming = [
			{ sourceKey: "p1||p2", sourceFingerprint: "position:p1|p2|t1" },
			{ sourceKey: "p1||p2", sourceFingerprint: "position:p1|p2|t2" },
		];

		const matches = matchAnnotationRows([rowA], incoming);

		expect(matches[0]).toBe(rowA);
		expect(matches[1]).toBeUndefined();
	});

	it("reconoce una anotación movida por sourceKey sin robar la fila de otra entrada", () => {
		const moved = {
			id: "moved",
			sourceKey: "k",
			sourceFingerprint: "index:0|text:viejo",
		};
		const exact = {
			id: "exact",
			sourceKey: "k",
			sourceFingerprint: "index:1|text:nuevo",
		};

		const matches = matchAnnotationRows(
			[moved, exact],
			[
				{ sourceKey: "k", sourceFingerprint: "index:1|text:nuevo" },
				{ sourceKey: "k", sourceFingerprint: "index:0|text:editado" },
			],
		);

		expect(matches[0]).toBe(exact);
		expect(matches[1]).toBe(moved);
	});

	it("convierte timestamps en ms a segundos y deja los de segundos intactos", () => {
		expect(toEpochSeconds(1784528020)).toBe(1784528020);
		expect(toEpochSeconds(1785766138805.2043)).toBe(1785766138);
	});

	it("compara una fila en ms antigua como más antigua que una en segundos", () => {
		const oldMilliseconds = { sourceTimestamp: 1785766138805.2043 };
		const newerSeconds = { sourceTimestamp: 1786000000 };

		expect(compareProgressSource(oldMilliseconds, newerSeconds)).toBeLessThan(
			0,
		);
		expect(
			compareProgressSource(newerSeconds, oldMilliseconds),
		).toBeGreaterThan(0);
	});

	it("selecciona la fila en segundos más reciente frente a una fila en ms antigua", () => {
		const result = selectCanonicalProgress([
			{
				percent: 0.9,
				maxPercent: 0.9,
				sourceTimestamp: 1785766138805.2043,
				revision: 9,
				completionStatus: "complete",
			},
			{
				percent: 0.3,
				maxPercent: 0.3,
				sourceTimestamp: 1786000000,
				revision: 1,
				completionStatus: "in-progress",
			},
		]);

		expect(result.currentPercent).toBe(0.3);
		expect(result.completionStatus).toBe("in-progress");
	});
});
