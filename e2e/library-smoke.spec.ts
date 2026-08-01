import { expect, test } from "@playwright/test";
import { TEST_RUN_PREFIX } from "./env";
import { login } from "./helpers/auth";
import {
	createManualObra,
	deleteObraByTitle,
	openObraDetailByTitle,
} from "./helpers/obras";

test("usuario no autenticado ve gate privado y link a login", async ({
	page,
}) => {
	await page.goto("/");

	await expect(page.getByRole("link", { name: "Ir a login" })).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("heading", { name: "Biblioteca" }).last(),
	).toBeVisible();
	await expect(
		page.getByText("Inicia sesión para ver tu biblioteca."),
	).toBeVisible();
});

test.describe("flujos autenticados", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("usuario E2E puede crear, ver y eliminar una obra manual", async ({
		page,
	}) => {
		const title = `${TEST_RUN_PREFIX} Manga smoke`;

		try {
			await createManualObra(page, {
				title,
				creator: "Playwright",
				type: "manga",
				totalProgress: "12",
				tags: "e2e, smoke",
			});

			await openObraDetailByTitle(page, title);
			await expect(page.getByText("Playwright")).toBeVisible();
			await expect(page.getByText("Manga", { exact: true })).toBeVisible();
		} finally {
			await deleteObraByTitle(page, title).catch(() => undefined);
		}
	});

	test("usuario E2E puede terminar una temporada y recibir el flujo de reseña", async ({
		page,
	}) => {
		const title = `${TEST_RUN_PREFIX} Serie progreso`;

		try {
			await createManualObra(page, {
				title,
				creator: "Playwright",
				type: "series",
				totalProgress: "2",
				tags: "e2e, progreso",
				status: "in-progress",
			});

			await openObraDetailByTitle(page, title);
			await page.getByRole("button", { name: "Editar" }).click();
			await page.getByRole("button", { name: "Editar por temporadas" }).click();
			await page.getByRole("button", { name: "Agregar temporada" }).click();
			await page.getByLabel("Episodios de la temporada 1").fill("2");
			await page.getByRole("button", { name: "Terminar temporada" }).click();
			await expect(page.getByText("Total: 2 / 2")).toBeVisible();

			await page.keyboard.press("Escape");
			await page.keyboard.press("Escape");
			await page.goto("/");
			await expect(
				page.getByText("Viendo ahora", { exact: true }),
			).toBeVisible();
			const panelCard = page.getByRole("article").filter({ hasText: title });
			await panelCard.getByRole("button", { name: "En progreso" }).click();
			await page
				.getByRole("button", { name: "Progreso por temporadas" })
				.click();
			await expect(page).toHaveURL(/\/$/);
			await expect(
				page.getByText(
					"Marca hasta dónde has visto editando temporada y capítulo.",
				),
			).toBeVisible();
			await page.locator('[data-slot="sheet-overlay"]').click({
				position: { x: 8, y: 8 },
			});
			await expect(
				page.getByText(
					"Marca hasta dónde has visto editando temporada y capítulo.",
				),
			).toBeHidden();
			await page.keyboard.press("Escape");

			await page.goto("/biblioteca");
			await page.getByRole("textbox", { name: "Buscar obras" }).fill(title);
			const obraRow = page.getByRole("row").filter({ hasText: title });
			await obraRow.getByRole("button", { name: "En progreso" }).click();
			await page
				.getByRole("button", { name: "Progreso por temporadas" })
				.click();
			await expect(
				page.getByText(
					"Marca hasta dónde has visto editando temporada y capítulo.",
				),
			).toBeVisible();
			await expect(page).toHaveURL(/\/biblioteca$/);
			await page.locator('[data-slot="sheet-overlay"]').click({
				position: { x: 8, y: 8 },
			});
			await expect(
				page.getByText(
					"Marca hasta dónde has visto editando temporada y capítulo.",
				),
			).toBeHidden();

			await page.keyboard.press("Escape");
			await openObraDetailByTitle(page, title);
			await page.getByRole("button", { name: "En progreso" }).click();
			await page
				.getByRole("button", { name: "Terminada", exact: true })
				.click();
			await expect(
				page.getByText(
					"Terminaste esta obra. ¿Quieres dejar una reseña ahora?",
				),
			).toBeVisible();
		} finally {
			await deleteObraByTitle(page, title).catch(() => undefined);
		}
	});
});
