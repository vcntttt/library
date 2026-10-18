import { useMemo, useSyncExternalStore } from "react";
import {
	type LibraryFilters,
	type LibrarySort,
	type SortDir,
	type SortKey,
	sortKeys,
} from "./biblioteca-filtering";

// Preferencias de vista de la biblioteca y de explorar; las claves ya guardadas en el navegador no cambian.
export interface VisibleColumns {
	type: boolean;
	status: boolean;
	reading: boolean;
}

const defaultFilters: LibraryFilters = { types: [], statuses: [] };
const defaultSort: LibrarySort = { key: "updatedAt", dir: "desc" };
const defaultColumns: VisibleColumns = {
	type: true,
	status: true,
	reading: true,
};

const memory = new Map<string, string>();

const listeners = new Set<() => void>();

// Un solo canal para todas las claves: las escrituras avisan a `listeners` y otras pestañas llegan por `storage`.
function subscribe(listener: () => void) {
	listeners.add(listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}

function readRaw(key: string): string | null {
	if (memory.has(key)) return memory.get(key) ?? null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeRaw(key: string, value: string) {
	try {
		window.localStorage.setItem(key, value);
		memory.delete(key);
	} catch {
		// Sin almacenamiento, la preferencia de esta pestaña vive en memoria.
		memory.set(key, value);
	}
	for (const listener of listeners) listener();
}

// El snapshot de servidor siempre es `null`; el cliente recupera la preferencia sin cambiar la primera vista de hidratación.
// Guardar solo ocurre al cambiar un valor, nunca al montar, para no borrar lo que el usuario ya guardó.
export function usePersistentPreference<T>(
	key: string,
	parse: (raw: string | null) => T,
) {
	const raw = useSyncExternalStore(
		subscribe,
		() => readRaw(key),
		() => null,
	);
	const value = useMemo(() => parse(raw), [raw, parse]);
	const setValue = (next: T) => writeRaw(key, JSON.stringify(next));

	return [value, setValue] as const;
}

function parseStored<T>(
	raw: string | null,
	fallback: T,
	read: (parsed: Partial<T>) => T,
): T {
	if (!raw) return fallback;
	try {
		return read(JSON.parse(raw) as Partial<T>);
	} catch {
		return fallback;
	}
}

const isSortKey = (value: unknown): value is SortKey =>
	(sortKeys as readonly unknown[]).includes(value);

const isSortDir = (value: unknown): value is SortDir =>
	value === "asc" || value === "desc";

export const parseFilters = (raw: string | null) =>
	parseStored(raw, defaultFilters, (parsed) => ({
		types: Array.isArray(parsed.types) ? parsed.types : [],
		statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
	}));

export const parseSort = (raw: string | null) =>
	parseStored(raw, defaultSort, (parsed) => ({
		key: isSortKey(parsed.key) ? parsed.key : defaultSort.key,
		dir: isSortDir(parsed.dir) ? parsed.dir : defaultSort.dir,
	}));

export const parseColumns = (raw: string | null) =>
	parseStored(raw, defaultColumns, (parsed) => ({
		type: parsed.type ?? true,
		status: parsed.status ?? true,
		reading: parsed.reading ?? true,
	}));

// Filtros y orden de una pantalla de la biblioteca; cada `scope` tiene sus propias claves guardadas.
export function useLibraryPreferences(scope: "biblioteca" | "explorar") {
	const [filters, setFilters] = usePersistentPreference(
		`library:${scope}:filters`,
		parseFilters,
	);
	const [sort, setSort] = usePersistentPreference(
		`library:${scope}:sort`,
		parseSort,
	);

	return { filters, setFilters, sort, setSort };
}

// Columnas de la tabla de la biblioteca; explorar no tiene columnas.
export const useVisibleColumns = () =>
	usePersistentPreference("library:biblioteca:columns", parseColumns);
