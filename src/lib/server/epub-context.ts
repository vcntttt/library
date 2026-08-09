import { posix } from "node:path";
import { inflateRawSync } from "node:zlib";
import { normalizeHighlightText } from "@/lib/reading/reconciliation";

export interface EpubParagraph {
	chapter: string;
	paragraph: string;
}

export interface EpubContextCandidate {
	id: string;
	chapter: string;
	paragraphIndex: number;
	before: string;
	passage: string;
	after: string;
}

export interface EpubContextResult {
	status: "found" | "ambiguous" | "not-found";
	candidates: EpubContextCandidate[];
}

export function extractContextFromChapters(
	chapters: EpubParagraph[],
	text: string,
): EpubContextResult {
	const target = normalizeHighlightText(text);
	if (!target) return { status: "not-found", candidates: [] };

	const candidates: EpubContextCandidate[] = [];
	for (let index = 0; index < chapters.length; index += 1) {
		const chapter = chapters[index];
		if (
			!chapter ||
			!normalizeHighlightText(chapter.paragraph).includes(target)
		) {
			continue;
		}
		candidates.push({
			id: `${index}`,
			chapter: chapter.chapter,
			paragraphIndex: index,
			before: chapters[index - 1]?.paragraph ?? "",
			passage: chapter.paragraph,
			after: chapters[index + 1]?.paragraph ?? "",
		});
	}

	return {
		status:
			candidates.length === 0
				? "not-found"
				: candidates.length === 1
					? "found"
					: "ambiguous",
		candidates,
	};
}

export function extractEpubContext(
	buffer: Uint8Array,
	text: string,
): EpubContextResult {
	const entries = readZipEntries(buffer);
	const container = readEntry(entries, "META-INF/container.xml");
	if (!container) return { status: "not-found", candidates: [] };
	const rootfile = container.match(
		/rootfile[^>]+full-path=["']([^"']+)["']/i,
	)?.[1];
	if (!rootfile) return { status: "not-found", candidates: [] };
	const opf = readEntry(entries, rootfile);
	if (!opf) return { status: "not-found", candidates: [] };

	const manifest = new Map<string, string>();
	for (const match of opf.matchAll(/<item\b([^>]+)>/gi)) {
		const attributes = parseAttributes(match[1] ?? "");
		if (attributes.id && attributes.href) {
			manifest.set(
				attributes.id,
				posix.normalize(
					posix.join(
						posix.dirname(rootfile),
						decodeURIComponent(attributes.href),
					),
				),
			);
		}
	}

	const chapters: EpubParagraph[] = [];
	for (const match of opf.matchAll(/<itemref\b([^>]+)>/gi)) {
		const idref = parseAttributes(match[1] ?? "").idref;
		const href = idref ? manifest.get(idref) : undefined;
		const chapterHtml = href ? readEntry(entries, href) : undefined;
		if (!chapterHtml) continue;
		const chapterTitle = extractChapterTitle(chapterHtml) || href || "Capítulo";
		const paragraphs = extractParagraphs(chapterHtml);
		for (const paragraph of paragraphs) {
			chapters.push({ chapter: chapterTitle, paragraph });
		}
	}

	return extractContextFromChapters(chapters, text);
}

function extractParagraphs(html: string) {
	const paragraphs = Array.from(
		html.matchAll(/<(?:p|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi),
	).map((match) => cleanHtmlText(match[1] ?? ""));
	return paragraphs.filter(Boolean);
}

function extractChapterTitle(html: string) {
	const heading = html.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
	return heading ? cleanHtmlText(heading) : "";
}

function cleanHtmlText(value: string) {
	return decodeEntities(
		value
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim(),
	);
}

function decodeEntities(value: string) {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&#(\d+);/g, (_, code: string) =>
			String.fromCodePoint(Number(code)),
		)
		.replace(/&#x([\da-f]+);/gi, (_, code: string) =>
			String.fromCodePoint(Number.parseInt(code, 16)),
		);
}

function parseAttributes(value: string) {
	const attributes: Record<string, string> = {};
	for (const match of value.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
		const key = match[1];
		if (key) attributes[key.toLocaleLowerCase()] = match[2] ?? "";
	}
	return attributes;
}

interface ZipEntry {
	method: number;
	compressedSize: number;
	data: Uint8Array;
}

function readZipEntries(buffer: Uint8Array) {
	const bytes = Buffer.from(buffer);
	const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (eocd < 0) return new Map<string, ZipEntry>();
	const centralOffset = bytes.readUInt32LE(eocd + 16);
	const centralSize = bytes.readUInt32LE(eocd + 12);
	const entries = new Map<string, ZipEntry>();
	let offset = centralOffset;
	const end = centralOffset + centralSize;
	while (offset < end && bytes.readUInt32LE(offset) === 0x02014b50) {
		const method = bytes.readUInt16LE(offset + 10);
		const compressedSize = bytes.readUInt32LE(offset + 20);
		const nameLength = bytes.readUInt16LE(offset + 28);
		const extraLength = bytes.readUInt16LE(offset + 30);
		const commentLength = bytes.readUInt16LE(offset + 32);
		const localOffset = bytes.readUInt32LE(offset + 42);
		const name = bytes
			.subarray(offset + 46, offset + 46 + nameLength)
			.toString("utf8");
		const localNameLength = bytes.readUInt16LE(localOffset + 26);
		const localExtraLength = bytes.readUInt16LE(localOffset + 28);
		const dataStart = localOffset + 30 + localNameLength + localExtraLength;
		entries.set(name, {
			method,
			compressedSize,
			data: bytes.subarray(dataStart, dataStart + compressedSize),
		});
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

function readEntry(entries: Map<string, ZipEntry>, name: string) {
	const entry = entries.get(posix.normalize(name));
	if (!entry) return undefined;
	if (entry.method === 0) return Buffer.from(entry.data).toString("utf8");
	if (entry.method === 8) return inflateRawSync(entry.data).toString("utf8");
	return undefined;
}
