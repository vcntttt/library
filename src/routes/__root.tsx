import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "@/components/theme-provider";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import Header from "../components/Header";
import appCss from "../styles.css?url";

const convex = new ConvexReactClient(env.VITE_CONVEX_URL, {
	expectAuth: true,
});

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Biblioteca",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="es" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body suppressHydrationWarning>
				<ConvexBetterAuthProvider authClient={authClient} client={convex}>
					<ThemeProvider>
						<Header />
						{children}
					</ThemeProvider>
				</ConvexBetterAuthProvider>
				<Scripts />
			</body>
		</html>
	);
}
