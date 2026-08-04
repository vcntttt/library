import { createFileRoute } from "@tanstack/react-router";
import { ReadingDashboard } from "@/components/reading/reading-dashboard";

export const Route = createFileRoute("/lectura/")({
	ssr: false,
	component: ReadingIndexRoute,
});

function ReadingIndexRoute() {
	return <ReadingDashboard />;
}
