import { createFileRoute } from "@tanstack/react-router";
import { ReadingInbox } from "@/components/reading/reading-inbox";
import {
	ReadingAuthGate,
	ReadingSubrouteLayout,
} from "@/components/reading/reading-navigation";

export const Route = createFileRoute("/lectura/inbox")({
	ssr: false,
	component: ReadingInboxRoute,
});

function ReadingInboxRoute() {
	return (
		<ReadingAuthGate>
			<ReadingSubrouteLayout
				current="Inbox"
				title="Inbox de lectura"
				description="Revisa las anotaciones nuevas que llegaron desde KOReader."
			>
				<ReadingInbox />
			</ReadingSubrouteLayout>
		</ReadingAuthGate>
	);
}
