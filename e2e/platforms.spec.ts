import { expect, test } from "@playwright/test";
import { TEST_RUN_PREFIX } from "./env";
import { login } from "./helpers/auth";
import {
	createManualObra,
	deleteObraByTitle,
	openObraDetailByTitle,
} from "./helpers/obras";

test("guarda plataformas por usuario y ofrece Stremio como alternativa", async ({
	page,
}) => {
	await login(page);
	const openSettings = async () => {
		await page.getByRole("button", { name: /Menú de usuario/ }).click();
		await page.getByRole("menuitem", { name: "Mis plataformas" }).click();
		await expect(
			page.getByRole("checkbox", { name: "Netflix", exact: true }),
		).toBeVisible();
	};
	await openSettings();
	const netflix = page.getByRole("checkbox", { name: "Netflix", exact: true });
	const fallback = page.getByRole("checkbox", { name: "Ofrecer Stremio" });
	const originalNetflix = await netflix.isChecked();
	const originalFallback = await fallback.isChecked();
	const title = `${TEST_RUN_PREFIX} Serie para comprobar plataformas`;
	try {
		await netflix.setChecked(!originalNetflix);
		await expect(
			page.getByText("Cambios guardados", { exact: true }),
		).toBeVisible();
		await fallback.setChecked(true);
		await expect(fallback).toBeChecked();
		await expect(fallback).toBeEnabled();
		await page.reload();
		await openSettings();
		await expect(netflix).toBeChecked({ checked: !originalNetflix });
		await expect(fallback).toBeChecked();
		await expect(
			page.getByRole("button", { name: "Conectar Stremio" }),
		).toBeVisible();
		await page.keyboard.press("Escape");
		await createManualObra(page, {
			title,
			creator: "Playwright",
			type: "series",
			totalProgress: "12",
			tags: "e2e",
		});
		await openObraDetailByTitle(page, title);
		const link = page.getByRole("link", { name: "Buscar en Stremio" });
		await expect(link).toHaveAttribute(
			"href",
			`https://web.stremio.com/#/search?search=${encodeURIComponent(title)}`,
		);
	} finally {
		await page.keyboard.press("Escape");
		await openSettings();
		await netflix.setChecked(originalNetflix);
		await expect(netflix).toBeEnabled();
		await fallback.setChecked(originalFallback);
		await expect(fallback).toBeEnabled();
		await page.keyboard.press("Escape");
		await deleteObraByTitle(page, title);
	}
});
