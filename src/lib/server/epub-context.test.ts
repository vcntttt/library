import { describe, expect, it } from "vitest";
import { extractContextFromChapters } from "./epub-context";

describe("extractContextFromChapters", () => {
	it("returns neighboring paragraphs for a normalized match", () => {
		const result = extractContextFromChapters(
			[
				{ chapter: "Capítulo 1", paragraph: "Antes del pasaje." },
				{
					chapter: "Capítulo 1",
					paragraph: "Una idea importante sobre atención.",
				},
				{ chapter: "Capítulo 1", paragraph: "Después del pasaje." },
			],
			"una\nidea importante",
		);

		expect(result.status).toBe("found");
		expect(result.candidates[0]).toMatchObject({
			before: "Antes del pasaje.",
			passage: "Una idea importante sobre atención.",
			after: "Después del pasaje.",
		});
	});

	it("reports ambiguity instead of choosing a paragraph", () => {
		const result = extractContextFromChapters(
			[
				{ chapter: "Uno", paragraph: "Una idea repetida." },
				{ chapter: "Dos", paragraph: "Otra cosa." },
				{ chapter: "Tres", paragraph: "Una idea repetida." },
			],
			"Una idea repetida",
		);

		expect(result.status).toBe("ambiguous");
		expect(result.candidates).toHaveLength(2);
	});
});
