import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SavePatch } from "@/components/obra-edit-patches";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveOptions {
	debounceKey?: string;
	delayMs?: number;
}

export interface ObraAutoSave {
	status: AutoSaveStatus;
	error: string | null;
	savePatch: (patch: SavePatch | null, options?: SaveOptions) => void;
	commitPatch: (patch: SavePatch) => Promise<boolean>;
	flushPendingSaves: () => void;
	retry: () => void;
}

interface SaveState {
	obraId: Id<"obras"> | null;
	status: AutoSaveStatus;
	error: string | null;
}

interface PendingSave {
	timer: ReturnType<typeof setTimeout>;
	send: () => void;
}

const IDLE_STATE: SaveState = { obraId: null, status: "idle", error: null };

// Guarda los cambios de una obra. Sin `debounceKey` envía al instante; con clave agrupa los cambios hasta `delayMs`.
// El estado se etiqueta con su obra para que un guardado ajeno no se muestre, y vive fuera de la sesión de edición:
// así un error sigue visible al reabrir el editor y los pendientes se envían al cerrar, cambiar de obra o desmontar.
export function useObraAutoSave(convexId: Id<"obras"> | null): ObraAutoSave {
	const updateObra = useMutation(convexApi.obras.update);
	const [saveState, setSaveState] = useState<SaveState>(IDLE_STATE);
	const pendingSaves = useRef(new Map<string, PendingSave>());
	const failedSave = useRef<{ id: Id<"obras">; patch: SavePatch } | null>(null);

	const commit = useCallback(
		async (id: Id<"obras">, patch: SavePatch) => {
			setSaveState({ obraId: id, status: "saving", error: null });
			try {
				await updateObra({ id, patch });
				failedSave.current = null;
				setSaveState({ obraId: id, status: "saved", error: null });
				return true;
			} catch (error) {
				failedSave.current = { id, patch };
				setSaveState({
					obraId: id,
					status: "error",
					error: error instanceof Error ? error.message : "No se pudo guardar.",
				});
				return false;
			}
		},
		[updateObra],
	);

	const commitPatch = useCallback(
		async (patch: SavePatch) => {
			if (!convexId) return false;
			return commit(convexId, patch);
		},
		[commit, convexId],
	);

	const flushPendingSaves = useCallback(() => {
		for (const pending of pendingSaves.current.values()) {
			clearTimeout(pending.timer);
			pending.send();
		}
		pendingSaves.current.clear();
	}, []);

	// Al desmontar se envían los pendientes. El llamador monta este hook por obra (con `key`), así que cambiar de obra también lo dispara.
	useEffect(() => flushPendingSaves, [flushPendingSaves]);

	const savePatch = useCallback(
		(patch: SavePatch | null, options?: SaveOptions) => {
			if (!patch) return;
			const { debounceKey, delayMs = 700 } = options ?? {};
			if (!debounceKey) {
				void commitPatch(patch);
				return;
			}
			const send = () => void commitPatch(patch);
			clearTimeout(pendingSaves.current.get(debounceKey)?.timer);
			const timer = setTimeout(() => {
				pendingSaves.current.delete(debounceKey);
				send();
			}, delayMs);
			pendingSaves.current.set(debounceKey, { timer, send });
			setSaveState({ obraId: convexId, status: "saving", error: null });
		},
		[commitPatch, convexId],
	);

	const retry = useCallback(() => {
		const failed = failedSave.current;
		if (failed) void commit(failed.id, failed.patch);
	}, [commit]);

	const view = saveState.obraId === convexId ? saveState : IDLE_STATE;

	return {
		status: view.status,
		error: view.error,
		savePatch,
		commitPatch,
		flushPendingSaves,
		retry,
	};
}
