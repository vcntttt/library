import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const displayDateFormatter = new Intl.DateTimeFormat("es-CL", {
	day: "2-digit",
	month: "2-digit",
	year: "2-digit",
	timeZone: "America/Santiago",
});

const dateInputFormatter = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "America/Santiago",
	year: "numeric",
});

const chileDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	hour: "2-digit",
	hour12: false,
	minute: "2-digit",
	month: "2-digit",
	second: "2-digit",
	timeZone: "America/Santiago",
	year: "numeric",
});

export function formatDateShort(value: string | number | Date) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const parts = getFormattedParts(displayDateFormatter, date);
	return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateInput(value?: string | number | Date) {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const parts = getFormattedParts(dateInputFormatter, date);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateInput(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
	if (!match) return undefined;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const timestamp = getChileDateTimestamp(year, month, day);

	return Number.isNaN(timestamp) ? undefined : timestamp;
}

function getChileDateTimestamp(year: number, month: number, day: number) {
	const localTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0);
	const firstGuess = localTimestamp - getChileOffsetMs(localTimestamp);
	const timestamp = localTimestamp - getChileOffsetMs(firstGuess);
	const parts = getChileDateParts(timestamp);

	if (parts.year !== year || parts.month !== month || parts.day !== day) {
		return Number.NaN;
	}

	return timestamp;
}

function getChileOffsetMs(timestamp: number) {
	const parts = getChileDateParts(timestamp);
	const chileAsUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);

	return chileAsUtc - timestamp;
}

function getChileDateParts(timestamp: number) {
	const parts = getFormattedParts(chileDateTimeFormatter, new Date(timestamp));

	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour === "24" ? "0" : parts.hour),
		minute: Number(parts.minute),
		second: Number(parts.second),
	};
}

function getFormattedParts(formatter: Intl.DateTimeFormat, date: Date) {
	return Object.fromEntries(
		formatter.formatToParts(date).map((part) => [part.type, part.value]),
	) as Record<Intl.DateTimeFormatPartTypes, string>;
}
