import { createFileRoute } from "@tanstack/react-router";
import { handler } from "@/lib/auth-server";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => {
				ensureAppRuntimeStarted();
				return handler(request);
			},
			POST: ({ request }) => {
				ensureAppRuntimeStarted();
				return handler(request);
			},
		},
	},
});
