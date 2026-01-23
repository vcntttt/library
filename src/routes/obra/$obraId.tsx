import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { ArrowLeft, Trash2 } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { StatusBadge } from "@/components/status-badge";
import { TypeBadge } from "@/components/type-badge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { authClient } from "@/lib/auth-client";
import { obraFromDoc } from "@/lib/obras";
import type { ObraId, ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/obra/$obraId")({
	ssr: false,
	component: WorkPage,
});

function WorkPage() {
	const { obraId } = Route.useParams();
	const id = obraId as ObraId;
	const navigate = Route.useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending || session === undefined) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<p className="text-sm text-muted-foreground">Cargando...</p>
			</div>
		);
	}

	if (session === null) {
		return (
			<div className="container mx-auto p-4 md:p-6 space-y-3">
				<p className="text-sm text-muted-foreground">
					Inicia sesion para ver esta obra.
				</p>
				<Link to="/login" className="text-sm underline underline-offset-4">
					Ir a login
				</Link>
			</div>
		);
	}

	return <WorkAuthed id={id} navigate={navigate} />;
}

function WorkAuthed({
	id,
	navigate,
}: {
	id: ObraId;
	navigate: (opts: { to: string }) => void;
}) {
	const doc = useQuery(api.obras.get, { id });
	const updateWork = useMutation(api.obras.update);
	const removeWork = useMutation(api.obras.remove);

	const form = useForm({
		defaultValues: {
			review: "",
			notes: "",
			progressCurrent: 0,
			progressTotal: 0,
		},
		onSubmit: async ({ value }) => {
			const hasProgress = doc?.type !== "movie";
			const canSaveProgress =
				!hasProgress ||
				(Number.isFinite(value.progressCurrent) &&
					Number.isFinite(value.progressTotal) &&
					value.progressTotal >= 0 &&
					value.progressCurrent >= 0 &&
					(value.progressTotal === 0 ||
						value.progressCurrent <= value.progressTotal));

			if (!canSaveProgress) return;

			const patch: Record<string, unknown> = {
				review: value.review.trim() || undefined,
				notes: value.notes.trim() || undefined,
			};

			if (hasProgress && value.progressTotal > 0) {
				patch.progress = {
					current: Math.min(value.progressCurrent, value.progressTotal),
					total: value.progressTotal,
				};
			}

			await updateWork({ id, patch });
		},
	});

	useEffect(() => {
		if (!doc) {
			return;
		}
		form.reset({
			review: doc.review ?? "",
			notes: doc.notes ?? "",
			progressCurrent: doc.progress?.current ?? 0,
			progressTotal: doc.progress?.total ?? 0,
		});
	}, [doc, form]);

	if (doc === undefined) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<p className="text-sm text-muted-foreground">Cargando...</p>
			</div>
		);
	}

	if (doc === null) {
		return (
			<div className="container mx-auto p-4 md:p-6 space-y-4">
				<p className="text-sm text-muted-foreground">Obra no encontrada.</p>
				<Link to="/biblioteca" className="text-sm underline underline-offset-3">
					Volver a la biblioteca
				</Link>
			</div>
		);
	}

	const obra = obraFromDoc(doc);
	const hasProgress = obra.type !== "movie";

	const handleStatusChange = async (status: ObraStatus) => {
		await updateWork({ id, patch: { status } });
	};

	const handleRatingChange = async (rating: number) => {
		await updateWork({ id, patch: { rating } });
	};

	const handleDelete = async () => {
		await removeWork({ id });
		navigate({ to: "/biblioteca" });
	};

	return (
		<div className="container mx-auto p-4 md:p-6 space-y-6">
			<div className="flex items-center justify-between gap-4">
				<Link
					to="/biblioteca"
					className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Volver
				</Link>

				<AlertDialog>
					<AlertDialogTrigger
						render={<Button variant="outline" size="sm" className="gap-2" />}
					>
						<Trash2 className="h-4 w-4" />
						Eliminar
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Eliminar obra?</AlertDialogTitle>
							<AlertDialogDescription>
								Esto no se puede deshacer.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancelar</AlertDialogCancel>
							<AlertDialogAction onClick={handleDelete}>
								Eliminar
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>

			<div className="rounded-xl border border-border/50 bg-card/50 p-4 md:p-6 space-y-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<TypeBadge type={obra.type} />
							<StatusBadge status={obra.status} />
						</div>
						<h1 className="text-2xl font-semibold tracking-tight">
							{obra.title}
						</h1>
						{obra.creator && (
							<p className="text-sm text-muted-foreground">{obra.creator}</p>
						)}
					</div>

					<div className="flex items-center gap-3">
						<StarRating
							rating={obra.rating}
							interactive
							onRatingChange={handleRatingChange}
						/>
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<p className="text-sm font-medium">Estado</p>
						<Select
							value={obra.status}
							onValueChange={(v) => handleStatusChange(v as ObraStatus)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="backlog">Pendiente</SelectItem>
								<SelectItem value="in-progress">En progreso</SelectItem>
								<SelectItem value="finished">Terminada</SelectItem>
								<SelectItem value="dropped">Abandonada</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Actualizado</p>
						<p className="text-sm text-muted-foreground">
							{new Date(obra.updatedAt).toLocaleString()}
						</p>
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					className="space-y-4"
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label>Resena</Label>
							<form.Field name="review">
								{(field) => (
									<Textarea
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Que te dejo esta obra?"
										rows={4}
									/>
								)}
							</form.Field>
						</div>
						<div className="space-y-2">
							<Label>Notas (Markdown)</Label>
							<form.Field name="notes">
								{(field) => (
									<Textarea
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ideas, citas, preguntas..."
										rows={8}
									/>
								)}
							</form.Field>
						</div>
					</div>

					{hasProgress && (
						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-2">
								<Label>Progreso</Label>
								<div className="flex items-center gap-2">
									<form.Field name="progressCurrent">
										{(field) => (
											<Input
												type="number"
												value={field.state.value}
												onChange={(e) =>
													field.handleChange(Number(e.target.value) || 0)
												}
												min={0}
												className="w-24"
											/>
										)}
									</form.Field>
									<span className="text-sm text-muted-foreground">/</span>
									<form.Field name="progressTotal">
										{(field) => (
											<Input
												type="number"
												value={field.state.value}
												onChange={(e) =>
													field.handleChange(Number(e.target.value) || 0)
												}
												min={0}
												className="w-24"
											/>
										)}
									</form.Field>
								</div>
								<form.Subscribe
									selector={(state) =>
										[
											state.values.progressCurrent,
											state.values.progressTotal,
										] as const
									}
								>
									{([progressCurrent, progressTotal]) => {
										const canSaveProgress =
											Number.isFinite(progressCurrent) &&
											Number.isFinite(progressTotal) &&
											progressTotal >= 0 &&
											progressCurrent >= 0 &&
											(progressTotal === 0 || progressCurrent <= progressTotal);

										if (canSaveProgress) return null;
										return (
											<p className="text-sm text-destructive">
												El progreso no puede superar el total.
											</p>
										);
									}}
								</form.Subscribe>
							</div>
							<div className="sm:col-span-2 flex items-end justify-end">
								<form.Subscribe
									selector={(state) =>
										[
											state.values.progressCurrent,
											state.values.progressTotal,
											state.isSubmitting,
										] as const
									}
								>
									{([progressCurrent, progressTotal, isSubmitting]) => {
										const canSaveProgress =
											Number.isFinite(progressCurrent) &&
											Number.isFinite(progressTotal) &&
											progressTotal >= 0 &&
											progressCurrent >= 0 &&
											(progressTotal === 0 || progressCurrent <= progressTotal);

										return (
											<Button
												type="submit"
												disabled={isSubmitting || !canSaveProgress}
												className={cn(
													!canSaveProgress && "pointer-events-none",
												)}
											>
												{isSubmitting ? "Guardando..." : "Guardar"}
											</Button>
										);
									}}
								</form.Subscribe>
							</div>
						</div>
					)}

					{!hasProgress && (
						<div className="flex justify-end">
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Guardando..." : "Guardar"}
									</Button>
								)}
							</form.Subscribe>
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
