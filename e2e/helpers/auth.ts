import { expect, type Page } from "@playwright/test";
import { getE2eCredentials } from "../env";

export async function login(page: Page) {
	const { email, password } = getE2eCredentials();

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Contraseña").fill(password);
	await page.getByRole("button", { name: "Entrar" }).click();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByText("Biblioteca privada")).toBeVisible();
}
