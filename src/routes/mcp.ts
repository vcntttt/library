import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createFileRoute } from "@tanstack/react-router";
import { createConvexServiceClient } from "@/lib/server/convex";
import { json, jsonError } from "@/lib/server/http";
import { createLibraryMcpServer } from "@/lib/server/library-mcp";
import { isAuthorizedMcpRequest } from "@/lib/server/mcp-auth";

async function handleMcpRequest(request: Request) {
	const ownerId = process.env.READING_INTEGRATION_OWNER_ID?.trim();
	const secret = process.env.LIBRARY_MCP_SECRET;
	if (!ownerId) {
		return jsonError("Falta configurar READING_INTEGRATION_OWNER_ID.", 503);
	}
	if (!secret) return jsonError("Falta configurar LIBRARY_MCP_SECRET.", 503);
	if (!isAuthorizedMcpRequest(request, secret)) {
		return jsonError("No autorizado.", 401);
	}
	if (request.method !== "POST") {
		return json({ error: "Método no permitido." }, 405);
	}

	// Sin estado: cada solicitud usa su propio servidor y transporte.
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	const server = createLibraryMcpServer(
		createConvexServiceClient(ownerId),
		process.env.OBSIDIAN_VAULT_PATH,
	);
	await server.connect(transport);
	return transport.handleRequest(request);
}

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			GET: ({ request }) => handleMcpRequest(request),
			POST: ({ request }) => handleMcpRequest(request),
			DELETE: ({ request }) => handleMcpRequest(request),
		},
	},
});
