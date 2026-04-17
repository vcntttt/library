import { QueryClient } from "@tanstack/react-query";

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				gcTime: 5 * 60_000,
				refetchOnWindowFocus: false,
				retry: 1,
			},
			mutations: {
				retry: 0,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	if (typeof window === "undefined") {
		return createQueryClient();
	}

	browserQueryClient ??= createQueryClient();
	return browserQueryClient;
}
