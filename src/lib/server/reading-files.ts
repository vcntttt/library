import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import {
	parseReadingSidecars,
	type ReadingAnnotationSnapshot,
	type ReadingFormat,
	type ReadingProgressSnapshot,
} from "@/lib/reading/sidecars";

const readableExtensions = new Set([".epub", ".pdf", ".azw3", ".mobi"]);

export interface ReadingFilePayload {
	sourceKey: string;
	sourcePath: string;
	title: string;
	format: ReadingFormat;
	fileHash: string;
	fileModifiedAt: number;
	progress: ReadingProgressSnapshot[];
	annotations: ReadingAnnotationSnapshot[];
}

export async function scanReadingBooks(rootPath: string) {
	const root = resolve(rootPath);
	const bookPaths = await findBookPaths(root);
	const maxFiles = parseLimit(process.env.READING_SYNC_MAX_FILES);
	const limitedPaths = bookPaths.slice(0, maxFiles);

	return Promise.all(
		limitedPaths.map((bookPath) => readBookPayload(root, bookPath)),
	);
}

async function findBookPaths(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const paths: string[] = [];

	for (const entry of entries) {
		if (entry.name === ".stfolder" || entry.name.startsWith(".")) continue;
		const entryPath = resolve(root, entry.name);
		if (entry.isDirectory()) {
			paths.push(...(await findBookPaths(entryPath)));
			continue;
		}

		if (readableExtensions.has(extname(entry.name).toLowerCase())) {
			paths.push(entryPath);
		}
	}

	return paths.sort((left, right) => left.localeCompare(right));
}

async function readBookPayload(root: string, bookPath: string) {
	const fileStats = await stat(bookPath);
	const file = await readFile(bookPath);
	const sourcePath = relative(root, bookPath).split("\\").join("/");
	const sourceKey = sourcePath;
	const sidecarDirectory = resolve(
		dirname(bookPath),
		`${basename(bookPath, extname(bookPath))}.sdr`,
	);
	const [progress, annotations] = await Promise.all([
		readSidecarJson(
			`${sidecarDirectory}/${basename(bookPath)}.syncery-progress.json`,
		),
		readSidecarJson(
			`${sidecarDirectory}/${basename(bookPath)}.syncery-annotations.json`,
		),
	]);
	const parsed = parseReadingSidecars({
		sourceKey,
		title: basename(bookPath, extname(bookPath)),
		format: formatFromExtension(extname(bookPath)),
		progress,
		annotations,
	});

	return {
		...parsed.document,
		sourcePath,
		fileHash: createHash("sha256").update(file).digest("hex"),
		fileModifiedAt: fileStats.mtimeMs,
		progress: parsed.progress,
		annotations: parsed.annotations,
	};
}

async function readSidecarJson(path: string) {
	try {
		return JSON.parse(await readFile(path, "utf8")) as unknown;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return undefined;
		}
		throw new Error(`No se pudo leer el sidecar ${path}.`, { cause: error });
	}
}

function formatFromExtension(extension: string): ReadingFormat {
	if (extension.toLowerCase() === ".epub") return "epub";
	if (extension.toLowerCase() === ".pdf") return "pdf";
	return "other";
}

function parseLimit(value: string | undefined) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return 500;
	return Math.min(5000, Math.floor(parsed));
}
