import { expect, test } from "@playwright/test";
import { TEST_RUN_PREFIX } from "./env";
import { login } from "./helpers/auth";
import {
	createManualObra,
	deleteObraByTitle,
	openObraDetailByTitle,
} from "./helpers/obras";

test("marcar plataformas no bloquea las demás opciones ni reinicia la conexión", async ({
	page,
}) => {
	await login(page);
	await page.getByRole("button", { name: /Menú de usuario/ }).click();
	await page.getByRole("menuitem", { name: "Mis plataformas" }).click();
	const option = page.getByRole("checkbox", { name: "Netflix", exact: true });
	await expect(option).toBeVisible();
	const original = await option.isChecked();
	await page.getByLabel("Correo de Stremio").fill("fixture@example.test");
	await page.getByRole("dialog").evaluate((dialog) => {
		const email = dialog.querySelector('input[name="email"]');
		const changes = { blocked: false, replaced: false };
		Object.assign(window, { platformChanges: changes });
		new MutationObserver((records) => {
			if (records.some((record) => record.attributeName === "disabled"))
				changes.blocked = true;
			if (dialog.querySelector('input[name="email"]') !== email)
				changes.replaced = true;
		}).observe(dialog, {
			attributes: true,
			childList: true,
			subtree: true,
			attributeFilter: ["disabled"],
		});
	});
	try {
		await option.setChecked(!original);
		await expect(
			page.getByText("Cambios guardados", { exact: true }),
		).toBeVisible();
		await expect(page.getByLabel("Correo de Stremio")).toHaveValue(
			"fixture@example.test",
		);
		const changes = await page.evaluate(() =>
			Reflect.get(window, "platformChanges"),
		);
		expect(changes).toEqual({ blocked: false, replaced: false });
	} finally {
		await option.setChecked(original);
		await expect(
			page.getByText("Cambios guardados", { exact: true }),
		).toBeVisible();
	}
});

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
