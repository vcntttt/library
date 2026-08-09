import { api as convexApi } from "@convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";
import { scanReadingBooksDetailed } from "@/lib/server/reading-files";

export async function runReadingSync(
	client: ConvexHttpClient,
	rootPath: string,
	trigger: "manual" | "automatic",
) {
	const runId = await client.mutation(convexApi.reading.beginSyncRun, {
		trigger,
	});
	try {
		const knownSources = await client.query(
			convexApi.reading.listSourceStates,
			{},
		);
		const scan = await scanReadingBooksDetailed(rootPath, { knownSources });
		const errors = [...scan.errors];
		let changedDocuments = 0;
		let importedAnnotations = 0;
		let importedProgress = 0;

		for (const file of scan.files) {
			try {
				const result = await client.mutation(convexApi.reading.upsertDocument, {
					document: file,
				});
				changedDocuments += result.changedDocuments;
				importedAnnotations += result.importedAnnotations;
				importedProgress += result.importedProgress;
			} catch (error) {
				errors.push({
					path: file.sourcePath,
					message:
						error instanceof Error
							? error.message
							: "No se pudo guardar el documento.",
				});
			}
		}
		if (errors.length > 0) {
			await client.mutation(convexApi.reading.markSourceErrors, {
				errors,
			});
		}

		if (!scan.truncated) {
			await client.mutation(convexApi.reading.markMissingSources, {
				sourceKeys: scan.observedSourceKeys,
			});
		}
		const status = errors.length > 0 ? "partial" : "completed";
		await client.mutation(convexApi.reading.finishSyncRun, {
			id: runId,
			status,
			processedDocuments: scan.files.length,
			changedDocuments,
			skippedFiles: scan.skipped.length,
			errors,
		});

		return {
			importedDocuments: scan.files.length,
			changedDocuments,
			importedAnnotations,
			importedProgress,
			skippedFiles: scan.skipped,
			errors,
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "No se pudo importar la biblioteca de lectura.";
		await client.mutation(convexApi.reading.finishSyncRun, {
			id: runId,
			status: "failed",
			processedDocuments: 0,
			changedDocuments: 0,
			skippedFiles: 0,
			errors: [{ path: "", message }],
		});
		throw error;
	}
}
