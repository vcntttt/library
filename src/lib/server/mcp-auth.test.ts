import { describe, expect, it } from "vitest";
import { isAuthorizedMcpRequest } from "./mcp-auth";

function requestWith(authorization?: string) {
	return new Request("https://library.test/mcp", {
		method: "POST",
		headers: authorization ? { authorization } : {},
	});
}

describe("isAuthorizedMcpRequest", () => {
	it("acepta el secreto correcto como Bearer", () => {
		expect(
			isAuthorizedMcpRequest(requestWith("Bearer token-ok"), "token-ok"),
		).toBe(true);
	});

	it("rechaza solicitudes sin credencial", () => {
		expect(isAuthorizedMcpRequest(requestWith(), "token-ok")).toBe(false);
	});

	it("rechaza secretos distintos, incluso de otro largo", () => {
		expect(
			isAuthorizedMcpRequest(requestWith("Bearer s3cre"), "token-ok"),
		).toBe(false);
		expect(
			isAuthorizedMcpRequest(requestWith("Bearer xxxxxx"), "token-ok"),
		).toBe(false);
	});

	it("rechaza esquemas que no son Bearer", () => {
		expect(
			isAuthorizedMcpRequest(requestWith("Basic token-ok"), "token-ok"),
		).toBe(false);
	});
});
