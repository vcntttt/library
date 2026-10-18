import { api as convexApi } from "@convex/_generated/api";
import { useAuthToken } from "@convex-dev/auth/react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useReducer, useRef } from "react";
import { IdeasEditor } from "@/components/ideas-editor";
import { IdeasNoteList } from "@/components/ideas-note-list";
import { IdeasReviewPanel } from "@/components/ideas-review-panel";
import { ReadingIntegrationGate } from "@/components/reading/reading-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	createIdea,
	fetchIdea,
	type IdeaFilePayload,
	saveIdea,
	syncIdeas,
} from "@/lib/ideas-api";

export const Route = createFileRoute("/ideas")({
	ssr: false,
	component: IdeasPage,
});

function IdeasPage() {
	return (
		<ReadingIntegrationGate
			title="Ideas"
			loginDescription="Inicia sesión para trabajar con tus notas de Obsidian."
			disabledDescription="La integración de ideas no está habilitada para este usuario."
		>
			<IdeasAuthed />
		</ReadingIntegrationGate>
	);
}

interface IdeasState {
	selectedPath: string | null;
	file: IdeaFilePayload | null;
	draft: string;
	newTitle: string;
	message: string | null;
	isBusy: boolean;
	conflictFile: IdeaFilePayload | null;
}

type IdeasAction =
	| { type: "selectStarted"; relativePath: string }
	| { type: "fileLoaded"; file: IdeaFilePayload }
	| { type: "created"; file: IdeaFilePayload }
	| { type: "saved"; file: IdeaFilePayload }
	| { type: "saveConflicted"; current: IdeaFilePayload | null; message: string }
	| { type: "conflictLoaded"; file: IdeaFilePayload }
	| { type: "draftChanged"; draft: string }
	| { type: "newTitleChanged"; newTitle: string }
	| { type: "messageChanged"; message: string | null }
	| { type: "busyChanged"; isBusy: boolean };

const initialIdeasState: IdeasState = {
	selectedPath: null,
	file: null,
	draft: "",
	newTitle: "",
	message: null,
	isBusy: false,
	conflictFile: null,
};

// Cada transición de la vista va por una acción, para que la selección, el archivo y el conflicto cambien juntos.
function ideasReducer(state: IdeasState, action: IdeasAction): IdeasState {
	switch (action.type) {
		case "selectStarted":
			return {
				...state,
				selectedPath: action.relativePath,
				file: null,
				message: null,
				conflictFile: null,
			};
		case "fileLoaded":
			return { ...state, file: action.file, draft: action.file.content };
		case "created":
			return {
				...state,
				newTitle: "",
				selectedPath: action.file.relativePath,
				file: action.file,
				draft: action.file.content,
				message: "Idea creada.",
				conflictFile: null,
			};
		case "saved":
			return {
				...state,
				file: action.file,
				draft: action.file.content,
				message: "Guardado en el vault.",
			};
		case "saveConflicted":
			return {
				...state,
				conflictFile: action.current ?? state.conflictFile,
				message: action.message,
			};
		case "conflictLoaded":
			return {
				...state,
				file: action.file,
				draft: action.file.content,
				conflictFile: null,
				message: "Se cargó la versión actual del vault.",
			};
		case "draftChanged":
			return { ...state, draft: action.draft };
		case "newTitleChanged":
			return { ...state, newTitle: action.newTitle };
		case "messageChanged":
			return { ...state, message: action.message };
		case "busyChanged":
			return { ...state, isBusy: action.isBusy };
	}
}

function IdeasAuthed() {
	const ideas = useQuery(convexApi.ideas.list, {});
	const dueIdeas = useQuery(convexApi.ideas.listDue, { limit: 20 });
	const authToken = useAuthToken();
	const [state, dispatch] = useReducer(ideasReducer, initialIdeasState);
	const { selectedPath, file, draft, newTitle, message, isBusy, conflictFile } =
		state;
	// Cada carga o creación toma un número; una respuesta tardía se descarta si ya hay otra selección.
	const requestIdRef = useRef(0);

	const handleSelect = async (relativePath: string) => {
		if (relativePath === selectedPath && file) return;
		const requestId = ++requestIdRef.current;
		dispatch({ type: "selectStarted", relativePath });
		if (!authToken) return;
		try {
			const nextFile = await fetchIdea(authToken, relativePath);
			if (requestId !== requestIdRef.current) return;
			dispatch({ type: "fileLoaded", file: nextFile });
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			dispatch({
				type: "messageChanged",
				message:
					error instanceof Error ? error.message : "No se pudo leer la idea.",
			});
		}
	};

	const handleSync = async () => {
		if (!authToken) return;
		dispatch({ type: "busyChanged", isBusy: true });
		dispatch({ type: "messageChanged", message: null });
		try {
			const syncedIdeas = await syncIdeas(authToken);
			dispatch({
				type: "messageChanged",
				message: `Se sincronizaron ${syncedIdeas} ideas.`,
			});
		} catch (error) {
			dispatch({
				type: "messageChanged",
				message:
					error instanceof Error
						? error.message
						: "No se pudieron sincronizar las ideas.",
			});
		} finally {
			dispatch({ type: "busyChanged", isBusy: false });
		}
	};

	const handleCreate = async () => {
		if (!authToken || !newTitle.trim() || isBusy) return;
		dispatch({ type: "busyChanged", isBusy: true });
		dispatch({ type: "messageChanged", message: null });
		try {
			const created = await createIdea(authToken, newTitle.trim());
			requestIdRef.current++;
			dispatch({ type: "created", file: created });
		} catch (error) {
			dispatch({
				type: "messageChanged",
				message:
					error instanceof Error ? error.message : "No se pudo crear la idea.",
			});
		} finally {
			dispatch({ type: "busyChanged", isBusy: false });
		}
	};

	const handleSave = async () => {
		if (!authToken || !file) return;
		dispatch({ type: "busyChanged", isBusy: true });
		dispatch({ type: "messageChanged", message: null });
		try {
			const result = await saveIdea(authToken, file, draft);
			if (result.status === "conflict") {
				dispatch({
					type: "saveConflicted",
					current: result.current,
					message:
						"La nota cambió en Obsidian. Decide qué versión cargar antes de guardar.",
				});
				return;
			}
			dispatch({ type: "saved", file: result.file });
		} catch (error) {
			dispatch({
				type: "messageChanged",
				message:
					error instanceof Error
						? error.message
						: "No se pudo guardar la idea.",
			});
		} finally {
			dispatch({ type: "busyChanged", isBusy: false });
		}
	};

	const loadConflictVersion = () => {
		if (!conflictFile) return;
		dispatch({ type: "conflictLoaded", file: conflictFile });
	};

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
				<header className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Obsidian
						</p>
						<h1 className="font-serif text-4xl font-semibold">Ideas</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Un lienzo libre para conectar lecturas, citas, anotaciones y
							cualquier otra idea.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Input
							value={newTitle}
							onChange={(event) =>
								dispatch({
									type: "newTitleChanged",
									newTitle: event.target.value,
								})
							}
							placeholder="Título de idea"
							className="rounded-none sm:w-52"
							onKeyDown={(event) => {
								if (event.key === "Enter") void handleCreate();
							}}
						/>
						<Button
							onClick={handleCreate}
							disabled={isBusy || !newTitle.trim()}
							className="rounded-none"
						>
							Nueva idea
						</Button>
						<Button
							onClick={handleSync}
							disabled={isBusy}
							variant="outline"
							className="rounded-none"
						>
							Sincronizar vault
						</Button>
					</div>
				</header>

				{message && (
					<div className="border border-border bg-card px-4 py-3 text-sm">
						<p>{message}</p>
						{conflictFile && (
							<Button
								variant="outline"
								size="sm"
								className="mt-3 rounded-none"
								onClick={loadConflictVersion}
							>
								Cargar versión del vault
							</Button>
						)}
					</div>
				)}

				<IdeasReviewPanel
					authToken={authToken}
					dueIdeas={dueIdeas}
					onMessage={(nextMessage) =>
						dispatch({ type: "messageChanged", message: nextMessage })
					}
				/>

				<div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
					<IdeasNoteList
						ideas={ideas}
						selectedPath={selectedPath}
						disabled={isBusy}
						onSelect={(relativePath) => void handleSelect(relativePath)}
					/>
					<IdeasEditor
						file={file}
						draft={draft}
						isBusy={isBusy}
						onDraftChange={(nextDraft) =>
							dispatch({ type: "draftChanged", draft: nextDraft })
						}
						onSave={handleSave}
					/>
				</div>
			</div>
		</div>
	);
}
