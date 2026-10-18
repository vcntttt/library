import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { IdeaFilePayload } from "@/lib/ideas-api";

interface IdeasEditorProps {
	file: IdeaFilePayload | null;
	draft: string;
	isBusy: boolean;
	onDraftChange: (draft: string) => void;
	onSave: () => void;
}

// El borrador vive en el padre porque la carga, la creación y el conflicto lo reemplazan; el modo de vista es solo local.
export function IdeasEditor({
	file,
	draft,
	isBusy,
	onDraftChange,
	onSave,
}: IdeasEditorProps) {
	const [mode, setMode] = useState<"edit" | "preview">("edit");

	return (
		<main className="min-h-[32rem] border border-border bg-card">
			{!file ? (
				<div className="flex min-h-[32rem] items-center justify-center p-8 text-center text-sm text-muted-foreground">
					Selecciona una idea o crea una nueva.
				</div>
			) : (
				<div className="space-y-4 p-5">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
						<p className="truncate text-xs text-muted-foreground">
							{file.relativePath}
						</p>
						<div className="flex gap-2">
							<Button
								variant={mode === "edit" ? "default" : "outline"}
								size="sm"
								className="rounded-none"
								onClick={() => setMode("edit")}
							>
								Editar
							</Button>
							<Button
								variant={mode === "preview" ? "default" : "outline"}
								size="sm"
								className="rounded-none"
								onClick={() => setMode("preview")}
							>
								Vista previa
							</Button>
							<Button
								size="sm"
								className="rounded-none"
								onClick={onSave}
								disabled={isBusy}
							>
								Guardar
							</Button>
						</div>
					</div>
					{mode === "edit" ? (
						<Textarea
							value={draft}
							onChange={(event) => onDraftChange(event.target.value)}
							className="min-h-[28rem] resize-y rounded-none font-mono text-sm leading-relaxed"
						/>
					) : (
						<article className="prose prose-stone dark:prose-invert max-w-none min-h-[28rem]">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
						</article>
					)}
				</div>
			)}
		</main>
	);
}
