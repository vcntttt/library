import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { env } from "@/env";

export const {
	handler,
	getToken,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = convexBetterAuthReactStart({
	convexUrl: env.VITE_CONVEX_URL,
	convexSiteUrl: env.VITE_CONVEX_SITE_URL,
	jwtCache: {
		enabled: true,
		expirationToleranceSeconds: 60,
		isAuthError: (error: unknown) =>
			error instanceof Error && error.message.includes("Unauthenticated"),
	},
});
