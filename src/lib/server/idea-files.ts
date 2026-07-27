import { createHash, randomUUID } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import {
	basename,
	dirname,
	extname,
	join,
	relative,
	resolve,
	sep,
} from "node:path";

export const ideasRelativeRoot = "100 - Knowledge/Ideas";

export interface IdeaFile {
	relativePath: string;
	title: string;
	content: string;
	contentHash: string;
	fileModifiedAt: number;
}

export async function listIdeaFiles(vaultPath: string) {
	const root = getIdeasRoot(vaultPath);
	return scanDirectory(vaultPath, root);
}

export async function readIdeaFile(vaultPath: string, relativePath: string) {
	const filePath = resolveIdeaPath(vaultPath, relativePath);
	const [content, fileStats] = await Promise.all([
		readFile(filePath, "utf8"),
		stat(filePath),
	]);
	return toIdeaFile(vaultPath, filePath, content, fileStats.mtimeMs);
}

export async function writeIdeaFile(
	vaultPath: string,
	relativePath: string,
	content: string,
	expectedHash?: string,
) {
	const filePath = resolveIdeaPath(vaultPath, relativePath);
	let current: IdeaFile | undefined;
	try {
		current = await readIdeaFile(vaultPath, relativePath);
	} catch (error) {
		if (!isMissingFileError(error)) throw error;
	}

	if (expectedHash && current && current.contentHash !== expectedHash) {
		return { conflict: true as const, current };
	}
	if (expectedHash && !current) {
		return { conflict: true as const, current: null };
	}

	await mkdir(dirname(filePath), { recursive: true });
	const temporaryPath = `${filePath}.tmp-${randomUUID()}`;
	await writeFile(temporaryPath, content, "utf8");
	await rename(temporaryPath, filePath);
	return {
		conflict: false as const,
		current: await readIdeaFile(vaultPath, relativePath),
	};
}

export async function createIdeaFile(
	vaultPath: string,
	title: string,
	content: string,
) {
	const root = getIdeasRoot(vaultPath);
	await mkdir(root, { recursive: true });
	const slug = slugify(title) || `idea-${randomUUID().slice(0, 8)}`;
	let counter = 0;
	let filePath = join(root, `${slug}.md`);
	while (await fileExists(filePath)) {
		counter += 1;
		filePath = join(root, `${slug}-${counter}.md`);
	}

	const initialContent = content.trimStart().startsWith("# ")
		? content
		: `# ${title.trim()}\n\n${content}`;
	await writeFile(filePath, initialContent, "utf8");
	return readIdeaFile(vaultPath, relative(vaultPath, filePath));
}

function getIdeasRoot(vaultPath: string) {
	return resolve(vaultPath, ideasRelativeRoot);
}

function resolveIdeaPath(vaultPath: string, relativePath: string) {
	const vaultRoot = resolve(vaultPath);
	const ideasRoot = getIdeasRoot(vaultPath);
	const candidate = resolve(vaultRoot, relativePath);
	const candidateRelativeToIdeas = relative(ideasRoot, candidate);
	if (
		!candidateRelativeToIdeas ||
		candidateRelativeToIdeas.startsWith(`..${sep}`) ||
		candidateRelativeToIdeas === ".." ||
		candidateRelativeToIdeas.includes(`${sep}.${sep}`) ||
		extname(candidate).toLowerCase() !== ".md"
	) {
		throw new Error("La ruta de la idea no es válida.");
	}
	return candidate;
}

async function scanDirectory(
	vaultPath: string,
	directory: string,
): Promise<IdeaFile[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: IdeaFile[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await scanDirectory(vaultPath, entryPath)));
			continue;
		}
		if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md")
			continue;
		const [content, fileStats] = await Promise.all([
			readFile(entryPath, "utf8"),
			stat(entryPath),
		]);
		files.push(toIdeaFile(vaultPath, entryPath, content, fileStats.mtimeMs));
	}
	return files.sort((left, right) =>
		left.relativePath.localeCompare(right.relativePath),
	);
}

function toIdeaFile(
	vaultPath: string,
	filePath: string,
	content: string,
	fileModifiedAt: number,
): IdeaFile {
	return {
		relativePath: relative(vaultPath, filePath).split("\\").join("/"),
		title: extractTitle(content, basename(filePath, extname(filePath))),
		content,
		contentHash: hashContent(content),
		fileModifiedAt,
	};
}

function extractTitle(content: string, fallback: string) {
	const withoutFrontmatter = content.replace(
		/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
		"",
	);
	return withoutFrontmatter.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function hashContent(content: string) {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

function slugify(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

async function fileExists(path: string) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

function isMissingFileError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "ENOENT"
	);
}
