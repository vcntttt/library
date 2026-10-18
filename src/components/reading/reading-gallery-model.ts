import type { api as convexApi } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type GalleryEntry = FunctionReturnType<
	typeof convexApi.reading.listAnnotations
>[number];
export type GallerySort = "shuffle" | "recent" | "oldest";
export type GalleryGroupBy = "none" | "chapter";

export interface GalleryAnnotationGroup {
	label: string | null;
	annotations: GalleryEntry[];
}

/** Seeded Fisher-Yates shuffle (deterministic for a given seed). */
function shuffleArray<T>(array: readonly T[], seed: number): T[] {
	const result = [...array];
	let s = seed;
	for (let i = result.length - 1; i > 0; i--) {
		// Simple mulberry32-style PRNG step
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		const j = Math.floor(r * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

interface GalleryFilter {
	searchQuery: string;
	selectedObraId: string;
	obraTitles: ReadonlyMap<string, string>;
}

// Busca en pasajes, notas, comentarios, capítulo y títulos; "unlinked" muestra solo documentos sin obra.
export function filterGalleryEntries(
	entries: readonly GalleryEntry[],
	{ searchQuery, selectedObraId, obraTitles }: GalleryFilter,
) {
	const term = searchQuery.trim().toLocaleLowerCase();

	return entries.filter(({ annotation, document }) => {
		if (selectedObraId === "unlinked" && document?.obraId) return false;
		if (
			selectedObraId !== "all" &&
			selectedObraId !== "unlinked" &&
			document?.obraId !== selectedObraId
		) {
			return false;
		}
		if (!term) return true;

		return [
			annotation.text,
			annotation.originalText,
			annotation.curatedText,
			annotation.note,
			annotation.comment,
			annotation.chapter,
			document?.title,
			document?.obraId ? obraTitles.get(document.obraId) : undefined,
		]
			.filter(Boolean)
			.some((value) => value?.toLocaleLowerCase().includes(term));
	});
}

// El orden "shuffle" usa la semilla para que "Mezclar de nuevo" cambie el orden sin volver a pedir datos.
export function sortGalleryEntries(
	entries: readonly GalleryEntry[],
	sortBy: GallerySort,
	shuffleSeed: number,
): GalleryEntry[] {
	if (sortBy === "shuffle") return shuffleArray(entries, shuffleSeed);

	const sorted = [...entries];
	sorted.sort((a, b) => {
		const aTime = a.annotation.capturedAt ?? "";
		const bTime = b.annotation.capturedAt ?? "";
		return sortBy === "oldest"
			? aTime.localeCompare(bTime)
			: bTime.localeCompare(aTime);
	});
	return sorted;
}

// Agrupa por documento y capítulo, conservando el orden de llegada de cada grupo.
export function groupGalleryEntries(
	entries: readonly GalleryEntry[],
	groupBy: GalleryGroupBy,
): GalleryAnnotationGroup[] {
	if (groupBy === "none") {
		return [{ label: null, annotations: [...entries] }];
	}

	const groups = new Map<string, GalleryAnnotationGroup & { label: string }>();
	for (const item of entries) {
		const chapter = item.annotation.chapter?.trim() || "Sin capítulo";
		const documentTitle = item.document?.title ?? "Documento sin título";
		const key = `${item.document?.id}:${chapter}`;
		const group = groups.get(key) ?? {
			label: `${documentTitle} · ${chapter}`,
			annotations: [],
		};
		group.annotations.push(item);
		groups.set(key, group);
	}

	return Array.from(groups.values());
}
