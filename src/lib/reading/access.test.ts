import { describe, expect, it } from "vitest";
import { hasReadingIntegrationAccess } from "./access";

describe("reading integration access", () => {
	it("only enables the feature for an authenticated integration owner", () => {
		expect(hasReadingIntegrationAccess(false, true)).toBe(false);
		expect(hasReadingIntegrationAccess(true, undefined)).toBe(false);
		expect(hasReadingIntegrationAccess(true, false)).toBe(false);
		expect(hasReadingIntegrationAccess(true, true)).toBe(true);
	});
});
