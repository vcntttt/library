import { createFileRoute } from "@tanstack/react-router";
import { ReadingDocuments } from "@/components/reading/reading-documents";
import {
	ReadingAuthGate,
	ReadingSubrouteLayout,
} from "@/components/reading/reading-navigation";

export const Route = createFileRoute("/lectura/documentos")({
	ssr: false,
	component: ReadingDocumentsRoute,
});

function ReadingDocumentsRoute() {
	return (
		<ReadingAuthGate>
			<ReadingSubrouteLayout
				current="Documentos"
				title="Documentos de lectura"
				description="Organiza los libros importados y enlázalos con tu biblioteca."
			>
				<ReadingDocuments />
			</ReadingSubrouteLayout>
		</ReadingAuthGate>
	);
}
