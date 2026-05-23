import { describe, expect, it } from "vitest";
import { formatDateInput, formatDateShort, parseDateInput } from "./utils";

describe("date helpers", () => {
	it("keeps date inputs stable in Chile time", () => {
		const timestamp = parseDateInput("2024-05-15");

		expect(timestamp).toBeDefined();
		expect(formatDateInput(timestamp)).toBe("2024-05-15");
		expect(formatDateShort(timestamp as number)).toBe("15/05/24");
	});

	it("does not shift date inputs during Chile daylight saving time", () => {
		const timestamp = parseDateInput("2024-12-15");

		expect(timestamp).toBeDefined();
		expect(formatDateInput(timestamp)).toBe("2024-12-15");
		expect(formatDateShort(timestamp as number)).toBe("15/12/24");
	});

	it("returns empty values for invalid dates", () => {
		expect(parseDateInput("")).toBeUndefined();
		expect(parseDateInput("15/05/2024")).toBeUndefined();
		expect(formatDateInput("not-a-date")).toBe("");
		expect(formatDateShort("not-a-date")).toBe("");
	});
});
