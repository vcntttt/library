export type ReadingFormat = "epub" | "pdf" | "other";

export interface ReadingSidecarInput {
	sourceKey: string;
	title: string;
	format: ReadingFormat;
	progress?: unknown;
	annotations?: unknown;
}

export interface ReadingDocumentSnapshot {
	sourceKey: string;
	title: string;
	format: ReadingFormat;
}

export interface ReadingProgressSnapshot {
	deviceId: string;
	deviceLabel?: string;
	filePath?: string;
	page?: number;
	percent?: number;
	totalPages?: number;
	revision?: number;
	sourceTimestamp?: number;
	locator?: string;
}

export interface ReadingAnnotationSnapshot {
	sourceKey: string;
	text: string;
	note?: string;
	chapter?: string;
	color?: string;
	page?: string;
	pageNumber?: number;
	positionStart?: string;
	positionEnd?: string;
	capturedAt?: string;
	updatedAtSource?: string;
	deviceId?: string;
	deviceLabel?: string;
}

export interface ReadingSidecarParseResult {
	document: ReadingDocumentSnapshot;
	progress: ReadingProgressSnapshot[];
	annotations: ReadingAnnotationSnapshot[];
}

export function parseReadingSidecars(
	input: ReadingSidecarInput,
): ReadingSidecarParseResult {
	return {
		document: {
			sourceKey: input.sourceKey,
			title: input.title.trim(),
			format: input.format,
		},
		progress: parseProgress(input.progress),
		annotations: parseAnnotations(input.annotations),
	};
}

function parseProgress(input: unknown): ReadingProgressSnapshot[] {
	const root = asRecord(input);
	const entries = asRecord(root?.entries);
	if (!entries) return [];

	return Object.entries(entries)
		.map(([entryKey, value]) => {
			const entry = asRecord(value);
			if (!entry) return undefined;

			const deviceId = asString(entry.device_id) ?? entryKey;
			const snapshot: ReadingProgressSnapshot = { deviceId };
			assignString(snapshot, "deviceLabel", entry.label);
			assignString(snapshot, "filePath", entry.file);
			assignNumber(snapshot, "page", entry.page);
			assignNumber(snapshot, "percent", entry.percent);
			assignNumber(snapshot, "totalPages", entry.total_pages);
			assignNumber(snapshot, "revision", entry.revision);
			assignNumber(snapshot, "sourceTimestamp", entry.timestamp);
			assignString(snapshot, "locator", entry.xpath);
			return snapshot;
		})
		.filter(
			(snapshot): snapshot is ReadingProgressSnapshot => snapshot !== undefined,
		)
		.sort(
			(left, right) =>
				(right.sourceTimestamp ?? 0) - (left.sourceTimestamp ?? 0),
		);
}

function parseAnnotations(input: unknown): ReadingAnnotationSnapshot[] {
	const root = asRecord(input);
	const annotations = asRecord(root?.annotations);
	if (!annotations) return [];

	return Object.entries(annotations)
		.map(([sourceKey, value]) => {
			const annotation = asRecord(value);
			const text = asString(annotation?.text)?.trim();
			if (!annotation || !text) return undefined;

			const result: ReadingAnnotationSnapshot = { sourceKey, text };
			assignString(result, "note", annotation.note ?? annotation.notes);
			assignString(result, "chapter", annotation.chapter);
			assignString(result, "color", annotation.color);
			assignString(result, "page", annotation.page);
			assignNumber(result, "pageNumber", annotation.pageno);
			assignString(result, "positionStart", annotation.pos0);
			assignString(result, "positionEnd", annotation.pos1);
			assignString(result, "capturedAt", annotation.datetime);
			assignString(result, "updatedAtSource", annotation.datetime_updated);
			assignString(result, "deviceId", annotation.device_id);
			assignString(result, "deviceLabel", annotation.device_label);
			return result;
		})
		.filter(
			(annotation): annotation is ReadingAnnotationSnapshot =>
				annotation !== undefined,
		);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function assignString<T extends object>(
	target: T,
	key: keyof T,
	value: unknown,
) {
	const normalized = asString(value);
	if (normalized !== undefined) {
		(target as Record<keyof T, unknown>)[key] = normalized;
	}
}

function assignNumber<T extends object>(
	target: T,
	key: keyof T,
	value: unknown,
) {
	const normalized = asNumber(value);
	if (normalized !== undefined) {
		(target as Record<keyof T, unknown>)[key] = normalized;
	}
}
