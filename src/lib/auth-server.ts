import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { getToken as getTokenFromHeaders } from "@convex-dev/better-auth/utils";
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
});

export const getTokenFromRequest = async (request: Request) => {
	const forwardedHeaders = new Headers();
	const cookie = request.headers.get("cookie");
	if (cookie) {
		forwardedHeaders.set("cookie", cookie);
	}

	const { token } = await getTokenFromHeaders(
		env.VITE_CONVEX_SITE_URL,
		forwardedHeaders,
	);

	return token;
};
