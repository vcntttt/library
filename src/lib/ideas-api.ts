export interface IdeaFilePayload {
	relativePath: string;
	title: string;
	content: string;
	contentHash: string;
	fileModifiedAt: number;
}

export type IdeaSaveResult =
	| { status: "saved"; file: IdeaFilePayload }
	| { status: "conflict"; current: IdeaFilePayload | null };

// Los errores del servidor llegan como JSON con `error`; el cuerpo solo se lee cuando el estado ya es de fallo.
async function readErrorMessage(response: Response, fallback: string) {
	const payload = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	return payload?.error ?? fallback;
}

export async function fetchIdea(token: string, relativePath: string) {
	const response = await fetch(
		`/api/ideas/content?path=${encodeURIComponent(relativePath)}`,
		{ headers: { authorization: `Bearer ${token}` } },
	);
	if (!response.ok) {
		throw new Error(
			await readErrorMessage(response, "No se pudo leer la idea."),
		);
	}
	return (await response.json()) as IdeaFilePayload;
}

export async function createIdea(token: string, title: string) {
	const response = await fetch("/api/ideas", {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ title, content: "" }),
	});
	if (!response.ok) {
		throw new Error(
			await readErrorMessage(response, "No se pudo crear la idea."),
		);
	}
	return (await response.json()) as IdeaFilePayload;
}

export async function syncIdeas(token: string) {
	const response = await fetch("/api/ideas/sync", {
		method: "POST",
		headers: { authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		throw new Error(
			await readErrorMessage(response, "No se pudieron sincronizar las ideas."),
		);
	}
	const payload = (await response.json()) as { syncedIdeas?: number };
	return payload.syncedIdeas ?? 0;
}

// Un 409 significa que la nota cambió en el vault; su versión actual viaja en el cuerpo.
export async function saveIdea(
	token: string,
	file: Pick<IdeaFilePayload, "relativePath" | "contentHash">,
	content: string,
): Promise<IdeaSaveResult> {
	const response = await fetch("/api/ideas/content", {
		method: "PUT",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			relativePath: file.relativePath,
			content,
			expectedHash: file.contentHash,
		}),
	});
	if (response.status === 409) {
		const payload = (await response.json().catch(() => null)) as {
			current?: IdeaFilePayload | null;
		} | null;
		return { status: "conflict", current: payload?.current ?? null };
	}
	if (!response.ok) {
		throw new Error(
			await readErrorMessage(response, "No se pudo guardar la idea."),
		);
	}
	return { status: "saved", file: (await response.json()) as IdeaFilePayload };
}
