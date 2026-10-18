import { timingSafeEqual } from "node:crypto";

export function isAuthorizedMcpRequest(
	request: Request,
	expectedSecret: string,
) {
	const received = request.headers
		.get("authorization")
		?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!received) return false;
	const receivedBytes = Buffer.from(received);
	const expectedBytes = Buffer.from(expectedSecret);
	return (
		receivedBytes.length === expectedBytes.length &&
		timingSafeEqual(receivedBytes, expectedBytes)
	);
}
