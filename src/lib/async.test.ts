import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./async";

describe("mapWithConcurrency", () => {
	it("procesa en serie las importaciones que comparten identidad y conserva el orden", async () => {
		const events: string[] = [];
		const result = await mapWithConcurrency([1, 2, 3], 1, async (item) => {
			events.push(`inicio ${item}`);
			await Promise.resolve();
			events.push(`fin ${item}`);
			return item * 2;
		});
		expect(events).toEqual([
			"inicio 1",
			"fin 1",
			"inicio 2",
			"fin 2",
			"inicio 3",
			"fin 3",
		]);
		expect(result).toEqual([2, 4, 6]);
	});

	it("limita los trabajos activos sin perder resultados", async () => {
		let active = 0;
		let peak = 0;
		const result = await mapWithConcurrency(
			[1, 2, 3, 4, 5],
			2,
			async (item) => {
				active += 1;
				peak = Math.max(peak, active);
				await Promise.resolve();
				active -= 1;
				return item;
			},
		);
		expect(peak).toBe(2);
		expect(result).toEqual([1, 2, 3, 4, 5]);
	});

	it("deja de iniciar trabajos tras un fallo y lo propaga", async () => {
		const visited: number[] = [];
		await expect(
			mapWithConcurrency([1, 2, 3], 1, async (item) => {
				visited.push(item);
				throw new Error("fallo de importación");
			}),
		).rejects.toThrow("fallo de importación");
		expect(visited).toEqual([1]);
	});
});
