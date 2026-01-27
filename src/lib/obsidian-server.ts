import { realpath, stat } from "node:fs/promises";
import path from "node:path";

const vaultEnvVar = "OBSIDIAN_VAULT_PATH";

export async function resolveVaultFile(relativePath: string) {
	const trimmedPath = relativePath.trim();
	if (!trimmedPath) {
		throw new Error("Path de Obsidian requerido.");
	}

	if (path.isAbsolute(trimmedPath)) {
		throw new Error("El path debe ser relativo al vault.");
	}

	const vaultRoot = await getVaultRoot();
	const candidatePath = path.resolve(vaultRoot, trimmedPath);
	let candidateRealPath: string;

	try {
		candidateRealPath = await realpath(candidatePath);
	} catch (error) {
		void error;
		throw new Error("Archivo de Obsidian no encontrado.");
	}

	if (!isPathInsideVault(candidateRealPath, vaultRoot)) {
		throw new Error("El path esta fuera del vault.");
	}

	const candidateStats = await stat(candidateRealPath);
	if (!candidateStats.isFile()) {
		throw new Error("El path no apunta a un archivo.");
	}

	return candidateRealPath;
}

export function buildObsidianOpenUrl(absolutePath: string) {
	return `obsidian://open?path=${encodeURIComponent(absolutePath)}`;
}

async function getVaultRoot() {
	const vaultPath = process.env[vaultEnvVar];
	if (!vaultPath) {
		throw new Error("Configura OBSIDIAN_VAULT_PATH.");
	}

	let vaultRealPath: string;
	try {
		vaultRealPath = await realpath(vaultPath);
	} catch (error) {
		void error;
		throw new Error("El vault no existe.");
	}

	const vaultStats = await stat(vaultRealPath);
	if (!vaultStats.isDirectory()) {
		throw new Error("El vault debe ser un directorio.");
	}

	return vaultRealPath;
}

function isPathInsideVault(targetPath: string, vaultRoot: string) {
	if (targetPath === vaultRoot) {
		return true;
	}

	const normalizedVault = vaultRoot.endsWith(path.sep)
		? vaultRoot
		: `${vaultRoot}${path.sep}`;
	return targetPath.startsWith(normalizedVault);
}
