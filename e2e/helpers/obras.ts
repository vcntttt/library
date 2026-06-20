import { expect, type Page } from "@playwright/test";

interface CreateManualObraInput {
	title: string;
	creator: string;
	type: "manga";
	totalProgress: string;
	tags: string;
}

export async function createManualObra(
	page: Page,
	input: CreateManualObraInput,
) {
	await page.goto("/biblioteca");
	await expect(page.getByRole("heading", { name: "Biblioteca" })).toBeVisible();

	await page.getByRole("button", { name: /Agregar (nueva )?obra/ }).click();
	await page.getByRole("button", { name: "Manga" }).click();
	await page
		.getByRole("button", { name: "Saltar búsqueda y crear manualmente" })
		.click();

	await page.getByLabel("Título").fill(input.title);
	await page.getByLabel("Autor / Director / Estudio").fill(input.creator);
	await page.getByLabel("Total capítulos").fill(input.totalProgress);
	await page.getByLabel("Etiquetas (separadas por coma)").fill(input.tags);
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
