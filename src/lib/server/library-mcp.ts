import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import {
	createIdeaFile,
	readIdeaFile,
	writeIdeaFile,
} from "@/lib/server/idea-files";

const obraTypes = [
	"book",
	"movie",
	"series",
	"anime",
	"manga",
	"manhwa",
] as const;
const obraStatuses = [
	"backlog",
	"in-progress",
	"paused",
	"hiatus",
	"finished",
	"dropped",
] as const;

type ObraSummary = {
	id: string;
	title: string;
	type: string;
	status: string;
	creator?: string;
	tags: string[];
	progress?: { current: number; total: number };
	readingProgressPercent?: number;
	reviewStatus?: string;
	startedAt?: number;
	finishedAt?: number;
	updatedAt: number;
};

function summarizeObra(obra: ObraSummary) {
	return {
		id: obra.id,
		title: obra.title,
		type: obra.type,
		status: obra.status,
		creator: obra.creator,
		tags: obra.tags,
		progress: obra.progress,
		readingProgressPercent: obra.readingProgressPercent,
		reviewStatus: obra.reviewStatus,
		startedAt: obra.startedAt,
		finishedAt: obra.finishedAt,
		updatedAt: obra.updatedAt,
	};
}

function result(value: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
	};
}

function toolError(error: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text:
					error instanceof Error
						? error.message
						: "Error inesperado en Library.",
			},
		],
		isError: true,
	};
}

async function run<T>(operation: () => Promise<T>) {
	try {
		return result(await operation());
	} catch (error) {
		return toolError(error);
	}
}

function requireVaultPath(vaultPath: string | undefined) {
	if (!vaultPath) throw new Error("Falta configurar OBSIDIAN_VAULT_PATH.");
	return vaultPath;
}

export function createLibraryMcpServer(
	client: ConvexHttpClient,
	vaultPath: string | undefined,
) {
	const server = new McpServer(
		{ name: "library", version: "0.1.0" },
		{
			instructions:
				"Library es la biblioteca cultural privada de su propietario: obras (libros, películas, series, anime, manga), anotaciones de lectura e ideas revisables guardadas en Obsidian. Consulta con las tools de lectura antes de modificar y pide confirmación a la persona antes de crear, editar o cambiar el estado de cualquier registro. Para editar una idea, lee primero su contenido con library_read_idea y envía el contentHash recibido: si el archivo cambió, la edición se rechaza.",
		},
	);

	server.registerTool(
		"library_list_obras",
		{
			title: "Listar obras",
			description:
				"Lista obras de la biblioteca con un resumen compacto (estado, progreso, etiquetas). Filtra por estado, tipo o texto del título. Para 'qué estoy leyendo/viendo' usa status=in-progress; para el backlog, status=backlog.",
			inputSchema: {
				status: z.enum(obraStatuses).optional(),
				type: z.enum(obraTypes).optional(),
				search: z
					.string()
					.min(1)
					.optional()
					.describe(
						"Texto contenido en el título o el autor, sin distinguir mayúsculas.",
					),
				limit: z
					.number()
					.int()
					.min(1)
					.max(200)
					.optional()
					.describe("Por defecto 50."),
			},
			annotations: { readOnlyHint: true },
		},
		({ status, type, search, limit }) =>
			run(async () => {
				const obras = await client.query(api.obras.list, {
					status,
					type,
					limit: search ? 500 : (limit ?? 50),
				});
				const needle = search?.toLowerCase();
				const matches = needle
					? obras.filter(
							(obra) =>
								obra.title.toLowerCase().includes(needle) ||
								obra.creator?.toLowerCase().includes(needle),
						)
					: obras;
				return matches.slice(0, limit ?? 50).map(summarizeObra);
			}),
	);

	server.registerTool(
		"library_get_obra",
		{
			title: "Obtener obra",
			description:
				"Devuelve una obra completa: metadatos, reseña, citas, progreso y estado de lectura.",
			inputSchema: { id: z.string().min(1) },
			annotations: { readOnlyHint: true },
		},
		({ id }) =>
			run(async () => {
				const obra = await client.query(api.obras.get, {
					id: id as Id<"obras">,
				});
				if (!obra) throw new Error("Obra no encontrada.");
				return obra;
			}),
	);

	server.registerTool(
		"library_create_obra",
		{
			title: "Crear obra",
			description:
				"Agrega una obra a la biblioteca. Pide confirmación antes de crearla y revisa con library_list_obras que no exista ya.",
			inputSchema: {
				title: z.string().min(1),
				type: z.enum(obraTypes),
				status: z
					.enum(obraStatuses)
					.optional()
					.describe("Por defecto backlog."),
				creator: z.string().optional(),
				tags: z.array(z.string()).optional(),
				recommendedBy: z.string().optional(),
				sourceUrl: z.string().url().optional(),
			},
		},
		(input) =>
			run(async () => {
				const obra = await client.mutation(api.obras.create, {
					...input,
					status: input.status ?? "backlog",
				});
				return summarizeObra(obra);
			}),
	);

	server.registerTool(
		"library_update_obra",
		{
			title: "Actualizar obra",
			description:
				"Cambia el estado, el progreso, las etiquetas o quién la recomendó. Para terminar una obra usa status=finished. El progreso de obras con documento de lectura vinculado lo controla la sincronización de KOReader y no se puede editar. Pide confirmación antes de modificar.",
			inputSchema: {
				id: z.string().min(1),
				status: z.enum(obraStatuses).optional(),
				progress: z
					.object({
						current: z.number().min(0),
						total: z.number().min(0),
					})
					.optional()
					.describe("Páginas, capítulos o episodios actuales sobre el total."),
				tags: z.array(z.string()).optional(),
				recommendedBy: z.string().optional(),
			},
		},
		({ id, ...patch }) =>
			run(async () => {
				if (Object.values(patch).every((value) => value === undefined)) {
					throw new Error("No hay cambios que aplicar.");
				}
				const obra = await client.mutation(api.obras.update, {
					id: id as Id<"obras">,
					patch,
				});
				return summarizeObra(obra);
			}),
	);

	server.registerTool(
		"library_list_pending_reviews",
		{
			title: "Reseñas pendientes",
			description: "Lista obras terminadas que aún esperan una reseña.",
			inputSchema: { limit: z.number().int().min(1).max(100).optional() },
			annotations: { readOnlyHint: true },
		},
		({ limit }) =>
			run(async () => {
				const obras = await client.query(api.obras.listPendingReviews, {
					limit,
				});
				return obras.map(summarizeObra);
			}),
	);

	server.registerTool(
		"library_save_review",
		{
			title: "Guardar reseña",
			description:
				"Guarda la reseña de una obra terminada. Redacta la reseña con la persona y confirma el texto antes de guardar.",
			inputSchema: { id: z.string().min(1), review: z.string().min(1) },
		},
		({ id, review }) =>
			run(async () => {
				const obra = await client.mutation(api.obras.saveReview, {
					id: id as Id<"obras">,
					review,
				});
				return summarizeObra(obra);
			}),
	);

	server.registerTool(
		"library_list_annotations",
		{
			title: "Listar anotaciones",
			description:
				"Lista anotaciones de lectura (subrayados y notas de KOReader) con su documento. Por defecto solo las pendientes de procesar.",
			inputSchema: {
				status: z
					.enum(["unprocessed", "kept", "ignored"])
					.optional()
					.describe("Por defecto unprocessed."),
				limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.describe("Por defecto 30."),
			},
			annotations: { readOnlyHint: true },
		},
		({ status, limit }) =>
			run(async () => {
				const rows = await client.query(api.reading.listAnnotations, {
					status: status ?? "unprocessed",
					limit: limit ?? 30,
				});
				return rows.map(({ annotation, document }) => ({
					id: annotation._id,
					status: annotation.status,
					text: annotation.text,
					comment: annotation.comment,
					document: document && {
						title: document.title,
						obraId: document.obraId,
					},
				}));
			}),
	);

	server.registerTool(
		"library_set_annotation_status",
		{
			title: "Conservar o ignorar anotación",
			description:
				"Marca una anotación como conservada (kept) o ignorada (ignored). Confirma con la persona antes de procesar varias.",
			inputSchema: {
				id: z.string().min(1),
				status: z.enum(["kept", "ignored"]),
			},
		},
		({ id, status }) =>
			run(async () => {
				await client.mutation(api.reading.setAnnotationStatus, {
					id: id as Id<"readingAnnotations">,
					status,
				});
				return { id, status };
			}),
	);

	server.registerTool(
		"library_list_ideas",
		{
			title: "Listar ideas",
			description:
				"Lista las ideas revisables (notas de Obsidian indexadas). Con dueOnly=true devuelve solo las que toca repasar hoy.",
			inputSchema: {
				dueOnly: z.boolean().optional(),
				limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.describe("Por defecto 30."),
			},
			annotations: { readOnlyHint: true },
		},
		({ dueOnly, limit }) =>
			run(async () => {
				const take = limit ?? 30;
				const ideas = dueOnly
					? await client.query(api.ideas.listDue, { limit: take })
					: (await client.query(api.ideas.list, {})).slice(0, take);
				return ideas.map((idea) => ({
					relativePath: idea.relativePath,
					title: idea.title,
					reviewDueAt: idea.reviewDueAt,
					reviewedAt: idea.reviewedAt,
					updatedAt: idea.updatedAt,
				}));
			}),
	);

	server.registerTool(
		"library_read_idea",
		{
			title: "Leer idea",
			description:
				"Devuelve el Markdown de una idea y su contentHash, necesario para editarla después.",
			inputSchema: { relativePath: z.string().min(1) },
			annotations: { readOnlyHint: true },
		},
		({ relativePath }) =>
			run(async () => {
				const file = await readIdeaFile(
					requireVaultPath(vaultPath),
					relativePath,
				);
				return {
					relativePath: file.relativePath,
					title: file.title,
					contentHash: file.contentHash,
					content: file.content,
				};
			}),
	);

	server.registerTool(
		"library_create_idea",
		{
			title: "Crear idea",
			description:
				"Crea una nota de idea en el vault de Obsidian y la indexa para repasarla. El contenido es Markdown libre; el título se agrega como encabezado si falta. Pide confirmación antes de crear.",
			inputSchema: {
				title: z.string().min(1),
				content: z.string().optional(),
			},
		},
		({ title, content }) =>
			run(async () => {
				const file = await createIdeaFile(
					requireVaultPath(vaultPath),
					title.trim(),
					content ?? "",
				);
				await client.mutation(api.ideas.upsert, {
					idea: {
						relativePath: file.relativePath,
						title: file.title,
						contentHash: file.contentHash,
						fileModifiedAt: file.fileModifiedAt,
					},
				});
				return {
					relativePath: file.relativePath,
					title: file.title,
					contentHash: file.contentHash,
				};
			}),
	);

	server.registerTool(
		"library_update_idea",
		{
			title: "Editar idea",
			description:
				"Reemplaza el Markdown completo de una idea existente. Exige el contentHash obtenido con library_read_idea; si la nota cambió desde entonces (por ejemplo en Obsidian), devuelve conflict=true con el contenido actual y no escribe. Muestra el cambio a la persona y confirma antes de guardar.",
			inputSchema: {
				relativePath: z.string().min(1),
				content: z.string().min(1),
				contentHash: z.string().min(1),
			},
		},
		({ relativePath, content, contentHash }) =>
			run(async () => {
				const outcome = await writeIdeaFile(
					requireVaultPath(vaultPath),
					relativePath,
					content,
					contentHash,
				);
				if (outcome.conflict) {
					return {
						conflict: true,
						message:
							"La idea cambió desde que la leíste. Revisa el contenido actual y vuelve a intentarlo.",
						current: outcome.current && {
							contentHash: outcome.current.contentHash,
							content: outcome.current.content,
						},
					};
				}
				const file = outcome.current;
				await client.mutation(api.ideas.upsert, {
					idea: {
						relativePath: file.relativePath,
						title: file.title,
						contentHash: file.contentHash,
						fileModifiedAt: file.fileModifiedAt,
					},
				});
				return {
					conflict: false,
					relativePath: file.relativePath,
					title: file.title,
					contentHash: file.contentHash,
				};
			}),
	);

	server.registerTool(
		"library_review_idea",
		{
			title: "Registrar repaso de idea",
			description:
				"Registra cómo salió el repaso de una idea (again, hard, good, easy) y programa el siguiente.",
			inputSchema: {
				relativePath: z.string().min(1),
				rating: z.enum(["again", "hard", "good", "easy"]),
			},
		},
		({ relativePath, rating }) =>
			run(async () => {
				await client.mutation(api.ideas.review, { relativePath, rating });
				return { relativePath, rating };
			}),
	);

	return server;
}
