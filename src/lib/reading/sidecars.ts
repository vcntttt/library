export type ReadingFormat = "epub" | "pdf" | "other";

export interface ReadingSidecarInput {
	sourceKey: string;
	title: string;
	format: ReadingFormat;
	progress?: unknown;
	annotations?: unknown;
	metadata?: unknown;
	metadataSourceTimestamp?: number;
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
	const koreader = parseKoreaderMetadata(
		input.metadata,
		input.metadataSourceTimestamp,
	);

	return {
		document: {
			sourceKey: input.sourceKey,
			title: input.title.trim(),
			format: input.format,
		},
		progress: [...parseProgress(input.progress), ...koreader.progress],
		annotations: [
			...parseAnnotations(input.annotations),
			...koreader.annotations,
		],
	};
}

function parseKoreaderMetadata(
	input: unknown,
	sourceTimestamp?: number,
): Pick<ReadingSidecarParseResult, "progress" | "annotations"> {
	if (typeof input !== "string" || !input.trim()) {
		return { progress: [], annotations: [] };
	}

	const root = parseLuaTable(input);
	const progress: ReadingProgressSnapshot[] = [];
	const percent = asNumber(root.percent_finished);
	const locator = asString(root.last_xpointer);
	if (percent !== undefined || locator !== undefined) {
		const snapshot: ReadingProgressSnapshot = {
			deviceId: "koreader",
			deviceLabel: "KOReader",
		};
		assignString(snapshot, "filePath", root.doc_path);
		assignNumber(snapshot, "percent", percent);
		assignNumber(snapshot, "totalPages", root.doc_pages);
		assignNumber(snapshot, "sourceTimestamp", sourceTimestamp);
		assignString(snapshot, "locator", locator);
		progress.push(snapshot);
	}

	const annotations = asRecord(root.annotations);
	if (!annotations) return { progress, annotations: [] };

	return {
		progress,
		annotations: Object.entries(annotations)
			.map(([entryKey, value]) => {
				const annotation = asRecord(value);
				const text = asString(annotation?.text)?.trim();
				if (!annotation || !text) return undefined;

				const positionStart = asString(annotation.pos0);
				const positionEnd = asString(annotation.pos1);
				const sourceKey =
					positionStart && positionEnd
						? `${positionStart}||${positionEnd}`
						: `koreader:${entryKey}`;
				const result: ReadingAnnotationSnapshot = { sourceKey, text };
				assignString(result, "note", annotation.note ?? annotation.notes);
				assignString(result, "chapter", annotation.chapter);
				assignString(result, "color", annotation.color);
				assignString(result, "page", annotation.page);
				assignNumber(result, "pageNumber", annotation.pageno);
				assignString(result, "positionStart", positionStart);
				assignString(result, "positionEnd", positionEnd);
				assignString(result, "capturedAt", annotation.datetime);
				assignString(result, "updatedAtSource", annotation.datetime_updated);
				assignString(result, "deviceId", annotation.device_id);
				assignString(result, "deviceLabel", annotation.device_label);
				return result;
			})
			.filter(
				(annotation): annotation is ReadingAnnotationSnapshot =>
					annotation !== undefined,
			),
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

type LuaValue = boolean | null | number | string | Record<string, LuaValue>;

function parseLuaTable(source: string): Record<string, unknown> {
	const parser = new LuaTableParser(source);
	const value = parser.parse();
	if (!isLuaTable(value)) {
		throw new Error(
			"El metadata de KOReader no contiene una tabla Lua válida.",
		);
	}
	return value;
}

function isLuaTable(value: LuaValue): value is Record<string, LuaValue> {
	return typeof value === "object" && value !== null;
}

class LuaTableParser {
	private index = 0;

	constructor(private readonly source: string) {}

	parse(): LuaValue {
		this.skipTrivia();
		if (this.readIdentifierIf("return")) this.skipTrivia();
		const value = this.parseValue();
		this.skipTrivia();
		if (this.index < this.source.length) {
			throw new Error("El metadata de KOReader contiene Lua no compatible.");
		}
		return value;
	}

	private parseValue(): LuaValue {
		this.skipTrivia();
		const character = this.source[this.index];
		if (character === "{") return this.parseTable();
		if (character === '"' || character === "'") return this.parseString();

		const number = this.source
			.slice(this.index)
			.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
		if (number) {
			this.index += number[0].length;
			return Number(number[0]);
		}

		const identifier = this.readIdentifier();
		if (identifier === "true") return true;
		if (identifier === "false") return false;
		if (identifier === "nil") return null;
		if (identifier) return identifier;
		throw new Error(
			"El metadata de KOReader contiene un valor Lua no compatible.",
		);
	}

	private parseTable(): Record<string, LuaValue> {
		this.expect("{");
		const table: Record<string, LuaValue> = {};
		let arrayIndex = 1;

		while (true) {
			this.skipTrivia();
			if (this.consume("}")) return table;
			if (this.consume(",") || this.consume(";")) continue;

			const key = this.parseExplicitKey();
			if (key !== undefined) {
				this.expect("=");
				table[String(key)] = this.parseValue();
			} else {
				table[String(arrayIndex)] = this.parseValue();
				arrayIndex += 1;
			}

			this.skipTrivia();
			this.consume(",") || this.consume(";");
		}
	}

	private parseExplicitKey(): string | number | undefined {
		this.skipTrivia();
		if (this.consume("[")) {
			const key = this.parseValue();
			this.expect("]");
			return typeof key === "string" || typeof key === "number"
				? key
				: undefined;
		}

		const start = this.index;
		const identifier = this.readIdentifier();
		if (identifier && this.peek("=")) return identifier;
		this.index = start;
		return undefined;
	}

	private parseString(): string {
		const quote = this.source[this.index++];
		let value = "";
		while (this.index < this.source.length) {
			const character = this.source[this.index++];
			if (character === quote) return value;
			if (character !== "\\") {
				value += character;
				continue;
			}

			const escaped = this.source[this.index++];
			if (escaped === "n") value += "\n";
			else if (escaped === "r") value += "\r";
			else if (escaped === "t") value += "\t";
			else if (escaped === "a") value += "\u0007";
			else if (escaped === "b") value += "\b";
			else if (escaped === "f") value += "\f";
			else if (escaped === "v") value += "\v";
			else if (escaped === "\n" || escaped === "\r") {
				value += " ";
				if (escaped === "\r" && this.source[this.index] === "\n") {
					this.index += 1;
				}
				while (/[ \t]/.test(this.source[this.index] ?? "")) {
					this.index += 1;
				}
			} else if (escaped === "z") {
				while (/\s/.test(this.source[this.index] ?? "")) this.index += 1;
			} else if (escaped && /\d/.test(escaped)) {
				let digits = escaped;
				while (digits.length < 3 && /\d/.test(this.source[this.index] ?? "")) {
					digits += this.source[this.index++];
				}
				value += String.fromCharCode(Number(digits));
			} else {
				value += escaped ?? "";
			}
		}
		throw new Error("El metadata de KOReader contiene una cadena sin cerrar.");
	}

	private readIdentifierIf(expected: string) {
		const start = this.index;
		const identifier = this.readIdentifier();
		if (identifier === expected) return true;
		this.index = start;
		return false;
	}

	private readIdentifier() {
		const match = this.source
			.slice(this.index)
			.match(/^[A-Za-z_][A-Za-z0-9_]*/);
		if (!match) return undefined;
		this.index += match[0].length;
		return match[0];
	}

	private skipTrivia() {
		while (this.index < this.source.length) {
			if (/\s/.test(this.source[this.index])) {
				this.index += 1;
				continue;
			}
			if (this.source.startsWith("--", this.index)) {
				const end = this.source.indexOf("\n", this.index + 2);
				this.index = end === -1 ? this.source.length : end + 1;
				continue;
			}
			break;
		}
	}

	private peek(character: string) {
		this.skipTrivia();
		return this.source[this.index] === character;
	}

	private consume(character: string) {
		this.skipTrivia();
		if (!this.source.startsWith(character, this.index)) return false;
		this.index += character.length;
		return true;
	}

	private expect(character: string) {
		if (!this.consume(character)) {
			throw new Error(`El metadata de KOReader esperaba «${character}».`);
		}
	}
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
