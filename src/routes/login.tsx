import { useForm } from "@tanstack/react-form";
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
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const [error, setError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			mode: "signin" as "signin" | "signup",
			name: "",
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			try {
				if (value.mode === "signup") {
					const { error } = await authClient.signUp.email({
						email: value.email,
						password: value.password,
						name: value.name.trim() || "Usuario",
					});
					if (error) throw error;
				} else {
					const { error } = await authClient.signIn.email({
						email: value.email,
						password: value.password,
					});
					if (error) throw error;
				}

				await router.navigate({ to: "/" });
			} catch (err) {
				setError(err instanceof Error ? err.message : "Error al autenticar");
				console.error("site url:", process.env.SITE_URL);
			}
		},
	});

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

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto max-w-md p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="rounded-2xl border border-border/60 bg-card/70 p-4 md:p-6 shadow-sm space-y-4">
					<form.Subscribe selector={(state) => state.values.mode}>
						{(mode) => (
							<>
								<div className="space-y-2">
									<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
										Acceso privado
									</p>
									<h1 className="text-2xl font-semibold tracking-tight font-serif">
										{mode === "signup" ? "Crear cuenta" : "Iniciar sesión"}
									</h1>
									<p className="text-sm text-muted-foreground">
										La biblioteca es privada. Necesitas una cuenta para entrar.
									</p>
								</div>

								<form
									onSubmit={(e) => {
										e.preventDefault();
										e.stopPropagation();
										void form.handleSubmit();
									}}
									className="space-y-4"
								>
									{mode === "signup" && (
										<form.Field name="name">
											{(field) => (
												<div className="space-y-2">
													<Label htmlFor={nameId}>Nombre</Label>
													<Input
														id={nameId}
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="Tu nombre"
														autoComplete="name"
													/>
												</div>
											)}
										</form.Field>
									)}

									<form.Field name="email">
										{(field) => (
											<div className="space-y-2">
												<Label htmlFor={emailId}>Email</Label>
												<Input
													id={emailId}
													type="email"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="tu@email.com"
													autoComplete="email"
													required
												/>
											</div>
										)}
									</form.Field>

									<form.Field name="password">
										{(field) => (
											<div className="space-y-2">
												<Label htmlFor={passwordId}>Contraseña</Label>
												<Input
													id={passwordId}
													type="password"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													autoComplete={
														mode === "signup"
															? "new-password"
															: "current-password"
													}
													required
												/>
											</div>
										)}
									</form.Field>

									{error && <p className="text-sm text-destructive">{error}</p>}

									<form.Subscribe selector={(state) => state.isSubmitting}>
										{(isSubmitting) => (
											<Button
												type="submit"
												className="w-full"
												disabled={isSubmitting}
											>
												{isSubmitting
													? "Procesando..."
													: mode === "signup"
														? "Crear cuenta"
														: "Entrar"}
											</Button>
										)}
									</form.Subscribe>
								</form>

								<div className="text-sm text-muted-foreground">
									{mode === "signup" ? (
										<button
											type="button"
											className="underline underline-offset-4"
											onClick={() => {
												setError(null);
												form.setFieldValue("mode", "signin");
											}}
										>
											Ya tienes cuenta? Inicia sesión
										</button>
									) : (
										<button
											type="button"
											className="underline underline-offset-4"
											onClick={() => {
												setError(null);
												form.setFieldValue("mode", "signup");
											}}
										>
											No tienes cuenta? Crea una
										</button>
									)}
								</div>
							</>
						)}
					</form.Subscribe>
				</div>
			</div>
		</div>
	);
}
