export interface ReadingProgressLike {
	percent?: number;
	maxPercent?: number;
	sourceTimestamp?: number;
	revision?: number;
	completionStatus?: "complete" | "in-progress";
}

export interface ReadingProgressSelection {
	currentPercent?: number;
	maxPercent?: number;
	completionStatus?: "complete" | "in-progress";
	selected: ReadingProgressLike | undefined;
}

export function normalizeHighlightText(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLocaleLowerCase();
}

export interface AnnotationIdentityInput {
	text: string;
	positionStart?: string;
	positionEnd?: string;
	capturedAt?: string;
}

export function buildAnnotationIdentity(
	annotation: AnnotationIdentityInput,
	nativeIndex: number,
) {
	const positionStart = annotation.positionStart?.trim();
	const positionEnd = annotation.positionEnd?.trim();
	const capturedAt = annotation.capturedAt?.trim();
	if (positionStart && positionEnd) {
		return `position:${positionStart}|${positionEnd}|${capturedAt ?? ""}`;
	}

	return `index:${nativeIndex}|text:${normalizeHighlightText(annotation.text)}`;
}

export function selectCanonicalProgress(
	progress: ReadingProgressLike[],
): ReadingProgressSelection {
	if (progress.length === 0) return { selected: undefined };

	const selected = progress.reduce(
		(current, candidate) => {
			if (!current) return candidate;
			return compareProgressSource(candidate, current) > 0
				? candidate
				: current;
		},
		undefined as ReadingProgressLike | undefined,
	);
	const maxPercent = progress.reduce<number | undefined>(
		(maximum, candidate) => {
			const candidateMaximum = Math.max(
				candidate.maxPercent ?? Number.NEGATIVE_INFINITY,
				candidate.percent ?? Number.NEGATIVE_INFINITY,
			);
			if (!Number.isFinite(candidateMaximum)) return maximum;
			return maximum === undefined
				? candidateMaximum
				: Math.max(maximum, candidateMaximum);
		},
		undefined,
	);

	return {
		currentPercent: selected?.percent,
		maxPercent,
		completionStatus: selected?.completionStatus,
		selected,
	};
}

export function compareProgressSource(
	left: ReadingProgressLike,
	right: ReadingProgressLike,
) {
	const timestampDifference =
		(left.sourceTimestamp ?? 0) - (right.sourceTimestamp ?? 0);
	if (timestampDifference !== 0) return timestampDifference;
	return (left.revision ?? 0) - (right.revision ?? 0);
}

export function isPossibleDuplicate(left: string, right: string) {
	const normalizedLeft = normalizeHighlightText(left);
	const normalizedRight = normalizeHighlightText(right);
	if (
		!normalizedLeft ||
		!normalizedRight ||
		normalizedLeft === normalizedRight
	) {
		return false;
	}

	return (
		normalizedLeft.includes(normalizedRight) ||
		normalizedRight.includes(normalizedLeft)
	);
}

export interface ExistingAnnotationRow {
	sourceKey: string;
	sourceFingerprint?: string;
}

export interface IncomingAnnotationIdentity {
	sourceKey: string;
	sourceFingerprint: string;
}

/**
 * Empareja cada anotación entrante con una fila existente, sin que dos entradas
 * reclamen la misma fila. Primero busca coincidencia exacta por huella; después,
 * por sourceKey, solo en filas que no sean la huella de otra entrada actual.
 */
export function matchAnnotationRows<T extends ExistingAnnotationRow>(
	existing: T[],
	incoming: IncomingAnnotationIdentity[],
): Array<T | undefined> {
	const incomingFingerprints = new Set(
		incoming.map((annotation) => annotation.sourceFingerprint),
	);
	const claimed = new Set<T>();
	const matches: Array<T | undefined> = incoming.map(() => undefined);

	incoming.forEach((annotation, index) => {
		const match = existing.find(
			(candidate) =>
				!claimed.has(candidate) &&
				candidate.sourceFingerprint === annotation.sourceFingerprint,
		);
		if (match) {
			matches[index] = match;
			claimed.add(match);
		}
	});

	incoming.forEach((annotation, index) => {
		if (matches[index]) return;
		const match = existing.find(
			(candidate) =>
				!claimed.has(candidate) &&
				candidate.sourceKey === annotation.sourceKey &&
				!(
					candidate.sourceFingerprint !== undefined &&
					incomingFingerprints.has(candidate.sourceFingerprint)
				),
		);
		if (match) {
			matches[index] = match;
			claimed.add(match);
		}
	});

	return matches;
}
