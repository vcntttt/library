import { describe, expect, it } from "vitest";
import { resolveCustomPatchValue } from "./custom-fields";

describe("resolveCustomPatchValue", () => {
	it("envía el blanco explícito cuando el original existe y el campo se vacía", () => {
		expect(
			resolveCustomPatchValue({
				next: undefined,
				custom: undefined,
				original: "Autor original",
				blank: "",
			}),
		).toBe("");
	});

	it("no reenvía el blanco si el override ya estaba vacío", () => {
		expect(
			resolveCustomPatchValue({
				next: undefined,
				custom: "",
				original: "Autor original",
				blank: "",
			}),
		).toBeUndefined();
	});

	it("limpia un override sobrante cuando no hay original", () => {
		expect(
			resolveCustomPatchValue({
				next: undefined,
				custom: "Autor manual",
				original: undefined,
				blank: "",
			}),
		).toBeNull();
	});

	it("no toca el campo si no había override ni original", () => {
		expect(
			resolveCustomPatchValue({
				next: undefined,
				custom: undefined,
				original: undefined,
				blank: 0,
			}),
		).toBeUndefined();
	});

	it("usa el valor nuevo cuando el usuario lo define", () => {
		expect(
			resolveCustomPatchValue({
				next: 2001,
				custom: 1990,
				original: 1985,
				blank: 0,
			}),
		).toBe(2001);
	});
});
