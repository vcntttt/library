import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const shortDateFormatter = new Intl.DateTimeFormat("es-CL", {
	day: "2-digit",
	month: "2-digit",
	year: "2-digit",
});

export function formatDateShort(value: string | number | Date) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return shortDateFormatter.format(date);
}
