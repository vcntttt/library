import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import type { Value } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [
		Password({
			profile(params: Record<string, Value | undefined>) {
				const email = String(params.email ?? "").trim().toLowerCase();
				const name = String(params.name ?? "").trim() || "Usuario";
				return { email, name };
			},
		}),
	],
});
