import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ReadingAuthGate } from "@/components/reading/reading-navigation";

export const Route = createFileRoute("/lectura")({
	ssr: false,
	component: ReadingPage,
});

function ReadingPage() {
	return (
		<ReadingAuthGate>
			<Outlet />
		</ReadingAuthGate>
	);
}
