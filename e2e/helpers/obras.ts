import { expect, type Page } from "@playwright/test";

interface CreateManualObraInput {
	title: string;
	creator: string;
	type: "manga" | "series";
	totalProgress: string;
	tags: string;
	status?: "in-progress";
}

export async function createManualObra(
	page: Page,
	input: CreateManualObraInput,
) {
	await page.goto("/biblioteca");
	await expect(page.getByRole("heading", { name: "Biblioteca" })).toBeVisible();

	await page.getByRole("button", { name: /Agregar (nueva )?obra/ }).click();
	await page
		.getByRole("button", {
			name: input.type === "manga" ? "Manga" : "Serie",
		})
		.click();
	await page
		.getByRole("button", { name: "Saltar búsqueda y crear manualmente" })
		.click();

	await page.getByLabel("Título").fill(input.title);
	await page.getByLabel("Autor / Director / Estudio").fill(input.creator);
	await page
		.getByLabel(input.type === "manga" ? "Total capítulos" : "Total episodios")
		.fill(input.totalProgress);
	await page.getByLabel("Etiquetas (separadas por coma)").fill(input.tags);
	if (input.status === "in-progress") {
		await page.getByText("Pendiente", { exact: true }).last().click();
		await page.getByRole("option", { name: "En progreso" }).click();
	}
	await page.getByRole("button", { name: "Agregar" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();
	await expect(page.getByRole("link", { name: input.title })).toBeVisible();
}

export async function openObraDetailByTitle(page: Page, title: string) {
	await page.goto("/biblioteca");
	await page.getByRole("textbox", { name: "Buscar obras" }).fill(title);
	await page.getByRole("link", { name: title }).click();

	await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

export async function deleteObraByTitle(page: Page, title: string) {
	await openObraDetailByTitle(page, title);

	await page.getByRole("button", { name: "Eliminar" }).click();
	const confirmDialog = page.getByRole("alertdialog");
	await expect(confirmDialog).toBeVisible();
	await confirmDialog.getByRole("button", { name: "Eliminar" }).click();

	await expect(page).toHaveURL(/\/biblioteca$/);
	await page.getByRole("textbox", { name: "Buscar obras" }).fill(title);
	await expect(page.getByRole("link", { name: title })).toHaveCount(0);
}
