import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

// The component client has methods needed for integrating Convex with Better Auth.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		plugins: [convex({ authConfig })],
		trustedOrigins: [
			"http://localhost",
			"http://localhost:*",
			"http://127.0.0.1",
			"http://127.0.0.1:*",
			"https://localhost",
			"https://localhost:*",
			"https://127.0.0.1",
			"https://127.0.0.1:*",
		],
	});
};

export const getCurrentUser = query({
	args: {},
	handler: (ctx) => {
		return authComponent.safeGetAuthUser(ctx);
	},
});
