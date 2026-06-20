export const TEST_RUN_PREFIX = `[E2E ${new Date().toISOString()}]`;

export interface E2eCredentials {
	email: string;
	password: string;
}

export function getE2eCredentials(): E2eCredentials {
	const email = process.env.E2E_TEST_EMAIL;
	const password = process.env.E2E_TEST_PASSWORD;

	if (!email || !password) {
		throw new Error(
			"Faltan E2E_TEST_EMAIL y/o E2E_TEST_PASSWORD. Configura una cuenta E2E dedicada antes de ejecutar tests autenticados.",
		);
	}

	return { email, password };
}
