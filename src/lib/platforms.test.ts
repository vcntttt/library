import { describe, expect, it } from "vitest";
import { getAccessiblePlatforms } from "./platforms";

describe("plataformas del usuario", () => {
	it("cruza la disponibilidad con los servicios del usuario y reconoce cambios de nombre", () => {
		expect(
			getAccessiblePlatforms(
				["HBO Max", "Disney Plus", "Netflix", "Disney Plus"],
				["Max", "Disney+"],
			),
		).toEqual(["HBO Max", "Disney Plus"]);
	});
	it("distingue disponibilidad desconocida y ninguna coincidencia sin inventar servicios", () => {
		expect(getAccessiblePlatforms(undefined, ["Netflix"])).toEqual([]);
		expect(getAccessiblePlatforms(["Netflix"], [])).toEqual([]);
		expect(
			getAccessiblePlatforms(
				["Amazon Prime Video"],
				["Amazon Prime Video with Ads"],
			),
		).toEqual([]);
	});
});
