import { api } from "@convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { streamingPlatforms } from "@/lib/platforms";

export function PlatformSettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Mis plataformas</DialogTitle>
					<DialogDescription>
						Elige los servicios a los que tienes acceso para encontrar dónde ver
						tus obras.
					</DialogDescription>
				</DialogHeader>
				{open && <PlatformSettings />}
			</DialogContent>
		</Dialog>
	);
}

function PlatformSettings() {
	const preferences = useQuery(api.platforms.getPreferences);
	const save = useMutation(api.platforms.savePreferences).withOptimisticUpdate(
		(store, preferences) => {
			store.setQuery(api.platforms.getPreferences, {}, preferences);
		},
	);
	const [state, setState] = useState<{
		saving: boolean;
		error: string | null;
		saved: boolean;
	}>({ saving: false, error: null, saved: false });

	if (!preferences) return <Skeleton className="h-48 w-full" />;

	const update = async (providers: string[], stremioEnabled: boolean) => {
		setState({ saving: true, error: null, saved: false });
		try {
			await save({ providers, stremioEnabled });
			setState({ saving: false, error: null, saved: true });
		} catch {
			setState({
				saving: false,
				error: "No se pudieron guardar las plataformas. Inténtalo de nuevo.",
				saved: false,
			});
		}
	};
	const selected = new Set(preferences.providers);
	const options = [
		...new Set([...streamingPlatforms, ...preferences.providers]),
	].sort((a, b) => a.localeCompare(b, "es"));
	return (
		<div className="space-y-6">
			<fieldset disabled={state.saving} className="grid grid-cols-2 gap-2">
				<legend className="sr-only">Servicios disponibles</legend>
				{options.map((name) => (
					<label
						key={name}
						className="flex min-h-10 min-w-0 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
					>
						<input
							type="checkbox"
							className="size-4 shrink-0 accent-primary"
							checked={selected.has(name)}
							onChange={(event) =>
								void update(
									event.target.checked
										? [...preferences.providers, name]
										: preferences.providers.filter(
												(provider) => provider !== name,
											),
									preferences.stremioEnabled,
								)
							}
						/>
						<span className="min-w-0 wrap-anywhere">{name}</span>
					</label>
				))}
			</fieldset>
			<label className="flex cursor-pointer items-start gap-3 text-sm">
				<input
					type="checkbox"
					className="mt-0.5 size-4 shrink-0 accent-primary"
					disabled={state.saving}
					checked={preferences.stremioEnabled}
					onChange={(event) =>
						void update(preferences.providers, event.target.checked)
					}
				/>
				<span>Ofrecer Stremio cuando no esté en mis plataformas</span>
			</label>
			<output className="min-h-4 text-xs text-muted-foreground">
				{state.saving
					? "Guardando…"
					: state.saved
						? "Cambios guardados"
						: "Los cambios se guardan automáticamente."}
			</output>
			{state.error && (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			)}
			<StremioConnection />
		</div>
	);
}

function StremioConnection() {
	const status = useQuery(api.stremio.status);
	const connect = useAction(api.stremio.connect);
	const sync = useAction(api.stremio.syncNow);
	const disconnect = useMutation(api.stremio.disconnect);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const run = async (operation: () => Promise<unknown>, success: string) => {
		setBusy(true);
		setError(null);
		setMessage(null);
		try {
			await operation();
			setMessage(success);
		} catch {
			setError(
				"No se pudo completar la conexión. Revisa tus credenciales o inténtalo más tarde.",
			);
		} finally {
			setBusy(false);
		}
	};
	return (
		<section className="space-y-3 border-t border-border pt-5">
			<h2 className="font-medium">Sincronizar con Stremio</h2>
			<p className="text-sm text-muted-foreground">
				Importa lo que ves y actualiza tu progreso cada hora, aunque Library
				esté cerrada.
			</p>
			{status === undefined ? (
				<Skeleton className="h-20 w-full" />
			) : status ? (
				<StremioAccount
					status={status}
					busy={busy}
					onSync={() => run(() => sync({}), "Sincronización completada.")}
					onDisconnect={() =>
						run(
							() => disconnect({}),
							"Cuenta desconectada. Tus obras se conservan.",
						)
					}
				/>
			) : (
				<StremioLoginForm
					busy={busy}
					onConnect={(credentials) =>
						run(() => connect(credentials), "Cuenta conectada.")
					}
				/>
			)}

			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			{message && (
				<output className="text-sm text-muted-foreground">{message}</output>
			)}
		</section>
	);
}

function StremioLoginForm({
	busy,
	onConnect,
}: {
	busy: boolean;
	onConnect: (credentials: {
		email: string;
		password: string;
	}) => Promise<void>;
}) {
	const emailId = useId();
	const passwordId = useId();
	return (
		<form
			className="space-y-3"
			action={async (data) => {
				await onConnect({
					email: String(data.get("email") ?? ""),
					password: String(data.get("password") ?? ""),
				});
			}}
		>
			<div className="space-y-2">
				<Label htmlFor={emailId}>Correo de Stremio</Label>
				<Input
					id={emailId}
					name="email"
					type="email"
					autoComplete="username"
					required
					disabled={busy}
					maxLength={254}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={passwordId}>Contraseña de Stremio</Label>
				<Input
					id={passwordId}
					name="password"
					type="password"
					autoComplete="current-password"
					required
					disabled={busy}
					maxLength={1024}
				/>
			</div>
			<p className="text-xs text-muted-foreground">
				Usamos tu contraseña para iniciar sesión; no la guardamos. La conexión
				importa tu actividad disponible sin modificar Stremio.
			</p>
			<Button type="submit" disabled={busy}>
				{busy ? "Conectando…" : "Conectar Stremio"}
			</Button>
		</form>
	);
}

function StremioAccount({
	status,
	busy,
	onSync,
	onDisconnect,
}: {
	status: NonNullable<FunctionReturnType<typeof api.stremio.status>>;
	busy: boolean;
	onSync: () => Promise<void>;
	onDisconnect: () => Promise<void>;
}) {
	const [availableAt, setAvailableAt] = useState<number | null>(null);
	useEffect(() => {
		const timer = setTimeout(
			() => setAvailableAt(status.nextSyncAt),
			Math.max(0, status.nextSyncAt - Date.now()),
		);
		return () => clearTimeout(timer);
	}, [status.nextSyncAt]);
	return (
		<>
			<p className="wrap-anywhere text-sm">{status.email}</p>
			<p className="text-xs text-muted-foreground">
				{status.lastSyncedAt
					? `Última sincronización: ${formatSyncDate(status.lastSyncedAt)}`
					: "Esperando la primera sincronización."}
			</p>
			{status.lastError && (
				<p role="alert" className="text-sm text-destructive">
					{status.lastError}
				</p>
			)}
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={busy || availableAt !== status.nextSyncAt}
					onClick={() => void onSync()}
				>
					{busy ? "Procesando…" : "Sincronizar ahora"}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={busy}
					onClick={() => void onDisconnect()}
				>
					Desconectar
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">
				Próxima sincronización a partir de {formatSyncDate(status.nextSyncAt)}.
			</p>
		</>
	);
}

const syncDateFormatter = new Intl.DateTimeFormat("es-CL", {
	timeZone: "America/Santiago",
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
});

function formatSyncDate(timestamp: number) {
	return syncDateFormatter.format(timestamp);
}
