import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ObraStatus, ObraType } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { Plus } from "./icons";
import { StarRating } from "./star-rating";

const obraTypes: { value: ObraType; label: string }[] = [
	{ value: "book", label: "Libro" },
	{ value: "movie", label: "Pelicula" },
	{ value: "series", label: "Serie" },
	{ value: "anime", label: "Anime" },
	{ value: "manga", label: "Manga" },
];

const obraStatuses: { value: ObraStatus; label: string }[] = [
	{ value: "backlog", label: "Pendiente" },
	{ value: "in-progress", label: "En progreso" },
	{ value: "finished", label: "Terminada" },
	{ value: "dropped", label: "Abandonada" },
];

export function AddObraDialog() {
	const [open, setOpen] = useState(false);
	const titleId = useId();
	const typeId = useId();
	const statusId = useId();
	const creatorId = useId();
	const totalId = useId();
	const tagsId = useId();
	const createObra = useMutation(api.obras.create);

	const form = useForm({
		defaultValues: {
			title: "",
			type: "book" as ObraType,
			status: "backlog" as ObraStatus,
			creator: "",
			tags: "",
			rating: 0,
			totalProgress: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.title.trim()) return;

			const parsedTotalProgress = Math.max(
				0,
				Number.parseInt(value.totalProgress, 10) || 0,
			);

			await createObra({
				title: value.title.trim(),
				type: value.type,
				status: value.status,
				creator: value.creator.trim() || undefined,
				tags: value.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				rating: value.rating > 0 ? value.rating : undefined,
				progress:
					value.type !== "movie" && parsedTotalProgress > 0
						? { current: 0, total: parsedTotalProgress }
						: undefined,
			});

			form.reset();
			setOpen(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
				<Plus className="h-4 w-4" />
				Agregar obra
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Nueva obra</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="title">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={titleId}>Titulo</Label>
								<Input
									id={titleId}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Escribe un titulo..."
									autoFocus
								/>
							</div>
						)}
					</form.Field>

					<div className="grid grid-cols-2 gap-4">
						<form.Field name="type">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={typeId}>Tipo</Label>
									<Select
										value={field.state.value}
										onValueChange={(v) => field.handleChange(v as ObraType)}
									>
										<SelectTrigger id={typeId}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{obraTypes.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>

						<form.Field name="status">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={statusId}>Estado</Label>
									<Select
										value={field.state.value}
										onValueChange={(v) => field.handleChange(v as ObraStatus)}
									>
										<SelectTrigger id={statusId}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{obraStatuses.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>
					</div>

					<form.Field name="creator">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={creatorId}>Autor / Director / Estudio</Label>
								<Input
									id={creatorId}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: Christopher Nolan"
								/>
							</div>
						)}
					</form.Field>

					<form.Subscribe selector={(state) => state.values.type}>
						{(type) =>
							type !== "movie" && (
								<form.Field name="totalProgress">
									{(field) => (
										<div className="space-y-2">
											<Label htmlFor={totalId}>
												Total{" "}
												{type === "book"
													? "paginas"
													: type === "manga"
														? "capitulos"
														: "episodios"}
											</Label>
											<Input
												id={totalId}
												type="number"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Ej: 320"
											/>
										</div>
									)}
								</form.Field>
							)
						}
					</form.Subscribe>

					<form.Field name="tags">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={tagsId}>Etiquetas (separadas por coma)</Label>
								<Textarea
									id={tagsId}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: sci-fi, filosofia, drama"
									rows={2}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="rating">
						{(field) => (
							<div className="space-y-2">
								<Label>Valoracion</Label>
								<StarRating
									rating={field.state.value}
									interactive
									onRatingChange={field.handleChange}
									size="lg"
								/>
							</div>
						)}
					</form.Field>

					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancelar
						</Button>
						<form.Subscribe
							selector={(state) =>
								[state.values.title, state.isSubmitting] as const
							}
						>
							{([title, isSubmitting]) => (
								<Button type="submit" disabled={isSubmitting || !title.trim()}>
									Agregar
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
