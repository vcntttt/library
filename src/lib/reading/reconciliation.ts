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
