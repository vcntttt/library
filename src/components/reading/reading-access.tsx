import { api as convexApi } from "@convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { hasReadingIntegrationAccess } from "@/lib/reading/access";

export function useReadingIntegrationAccess() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	const isIntegrationOwner = useQuery(
		convexApi.reading.isIntegrationOwner,
		isAuthenticated ? {} : "skip",
	);

	return {
		isAuthenticated,
		isLoading:
			isLoading || (isAuthenticated && isIntegrationOwner === undefined),
		hasAccess: hasReadingIntegrationAccess(isAuthenticated, isIntegrationOwner),
	};
}
