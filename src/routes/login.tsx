import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	ssr: false,
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (isPending || session === undefined) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<p className="text-sm text-muted-foreground">Cargando...</p>
			</div>
		);
	}

	if (session) {
		void router.navigate({ to: "/" });
		return null;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submitting) return;
		setSubmitting(true);
		setError(null);

		try {
			if (mode === "signup") {
				const { error } = await authClient.signUp.email({
					email,
					password,
					name: name.trim() || "Usuario",
				});
				if (error) throw error;
			} else {
				const { error } = await authClient.signIn.email({
					email,
					password,
				});
				if (error) throw error;
			}

			await router.navigate({ to: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al autenticar");
			setSubmitting(false);
		}
	};

	return (
		<div className="container mx-auto max-w-md p-4 md:p-6">
			<div className="rounded-xl border border-border/50 bg-card/50 p-4 md:p-6 space-y-4">
				<div className="space-y-1">
					<h1 className="text-xl font-semibold tracking-tight">
						{mode === "signup" ? "Crear cuenta" : "Iniciar sesion"}
					</h1>
					<p className="text-sm text-muted-foreground">
						Library es privada. Necesitas una cuenta para entrar.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{mode === "signup" && (
						<div className="space-y-2">
							<Label htmlFor={nameId}>Nombre</Label>
							<Input
								id={nameId}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Tu nombre"
								autoComplete="name"
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor={emailId}>Email</Label>
						<Input
							id={emailId}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="tu@email.com"
							autoComplete="email"
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={passwordId}>Contrasena</Label>
						<Input
							id={passwordId}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete={
								mode === "signup" ? "new-password" : "current-password"
							}
							required
						/>
					</div>

					{error && <p className="text-sm text-destructive">{error}</p>}

					<Button type="submit" className="w-full" disabled={submitting}>
						{submitting
							? "Procesando..."
							: mode === "signup"
								? "Crear cuenta"
								: "Entrar"}
					</Button>
				</form>

				<div className="text-sm text-muted-foreground">
					{mode === "signup" ? (
						<button
							type="button"
							className="underline underline-offset-4"
							onClick={() => setMode("signin")}
						>
							Ya tienes cuenta? Inicia sesion
						</button>
					) : (
						<button
							type="button"
							className="underline underline-offset-4"
							onClick={() => setMode("signup")}
						>
							No tienes cuenta? Crea una
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
