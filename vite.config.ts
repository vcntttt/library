import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

const config = defineConfig({
	plugins: [
		devtools({
			eventBusConfig: {
				enabled: process.env.E2E !== "1",
			},
		}),
		nitro(),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		VitePWA({
			registerType: "autoUpdate",
			manifest: false,
			includeAssets: ["favicon.ico", "logo192.png", "logo512.png"],
			workbox: {
				cleanupOutdatedCaches: true,
				globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
			},
		}),
	],
	test: {
		exclude: [...configDefaults.exclude, "e2e/**"],
	},
});

export default config;
