import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
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
	const [review, setReview] = useState("");
	const [notes, setNotes] = useState("");
	const [progressCurrent, setProgressCurrent] = useState(0);
	const [progressTotal, setProgressTotal] = useState(0);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!doc) {
			return;
		}
		setReview(doc.review ?? "");
		setNotes(doc.notes ?? "");
		setProgressCurrent(doc.progress?.current ?? 0);
		setProgressTotal(doc.progress?.total ?? 0);
	}, [doc]);

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

	const canSaveProgress =
		hasProgress &&
		Number.isFinite(progressCurrent) &&
		Number.isFinite(progressTotal) &&
		progressTotal >= 0 &&
		progressCurrent >= 0 &&
		(progressTotal === 0 || progressCurrent <= progressTotal);

	const handleSave = async () => {
		if (isSaving) return;
		if (!canSaveProgress) return;
		setIsSaving(true);
		try {
			const patch: Record<string, unknown> = {
				review: review.trim() || undefined,
				notes: notes.trim() || undefined,
			};

			if (hasProgress && progressTotal > 0) {
				patch.progress = {
					current: Math.min(progressCurrent, progressTotal),
					total: progressTotal,
				};
			}

			await updateWork({ id, patch });
		} finally {
			setIsSaving(false);
		}
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

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label>Resena</Label>
						<Textarea
							value={review}
							onChange={(e) => setReview(e.target.value)}
							placeholder="Que te dejo esta obra?"
							rows={4}
						/>
					</div>
					<div className="space-y-2">
						<Label>Notas (Markdown)</Label>
						<Textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Ideas, citas, preguntas..."
							rows={8}
						/>
					</div>
				</div>

				{hasProgress && (
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="space-y-2">
							<Label>Progreso</Label>
							<div className="flex items-center gap-2">
								<Input
									type="number"
									value={progressCurrent}
									onChange={(e) =>
										setProgressCurrent(Number(e.target.value) || 0)
									}
									min={0}
									className="w-24"
								/>
								<span className="text-sm text-muted-foreground">/</span>
								<Input
									type="number"
									value={progressTotal}
									onChange={(e) =>
										setProgressTotal(Number(e.target.value) || 0)
									}
									min={0}
									className="w-24"
								/>
							</div>
							{!canSaveProgress && (
								<p className="text-sm text-destructive">
									El progreso no puede superar el total.
								</p>
							)}
						</div>
						<div className="sm:col-span-2 flex items-end justify-end">
							<Button
								onClick={handleSave}
								disabled={isSaving || !canSaveProgress}
								className={cn(!canSaveProgress && "pointer-events-none")}
							>
								{isSaving ? "Guardando..." : "Guardar"}
							</Button>
						</div>
					</div>
				)}

				{!hasProgress && (
					<div className="flex justify-end">
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Guardando..." : "Guardar"}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
