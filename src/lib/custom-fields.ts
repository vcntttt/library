// Decide qué enviar al vaciar un campo con override. `blank` es el valor que el servidor
// guarda como "vaciado a propósito"; sin él, el original de los metadatos reaparecería.
export function resolveCustomPatchValue<T extends string | number>(args: {
	next: T | undefined;
	custom: T | null | undefined;
	original: T | null | undefined;
	blank: T;
}): T | null | undefined {
	const { next, custom, original, blank } = args;
	if (next !== undefined) return next;
	if (original != null && original !== blank) {
		return custom === blank ? undefined : blank;
	}
	return custom != null && custom !== blank ? null : undefined;
}
