import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { getQueryClient } from "@/lib/query-client";
import Header from "../components/Header";
import appCss from "../styles.css?url";

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
				name: "theme-color",
				content: "#F5F2EB",
			},
			{
				title: "Biblioteca",
			},
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/library.svg",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	return (
		<html lang="es" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body suppressHydrationWarning>
				<QueryClientProvider client={queryClient}>
					<ThemeProvider>
						<Header />
						{children}
					</ThemeProvider>
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}
