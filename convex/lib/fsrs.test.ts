import { describe, expect, it } from "vitest";
import { scheduleReview } from "./fsrs";

describe("scheduleReview", () => {
	it("crea una tarjeta de repaso desde una idea libre", () => {
		const result = scheduleReview(undefined, "good", Date.UTC(2026, 6, 26));

		expect(result.card.reps).toBe(1);
		expect(result.card.due).toBeGreaterThan(Date.UTC(2026, 6, 26));
		expect(result.log.rating).toBe(3);
	});

	it("conserva el estado de la tarjeta entre repasos", () => {
		const first = scheduleReview(undefined, "good", Date.UTC(2026, 6, 26));
		const second = scheduleReview(first.card, "easy", Date.UTC(2026, 6, 28));

		expect(second.card.reps).toBe(2);
		expect(second.card.stability).toBeGreaterThan(first.card.stability);
		expect(second.log.rating).toBe(4);
	});
});
