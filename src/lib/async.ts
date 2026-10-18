// Limita recursos y conserva el orden de los resultados; usa 1 para tareas dependientes.
export async function mapWithConcurrency<Item, Result>(
	items: readonly Item[],
	concurrency: number,
	visit: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		throw new Error("La concurrencia debe ser un entero positivo.");
	}
	const results = new Array<Result>(items.length);
	let nextIndex = 0;
	let failed = false;
	const work = async (): Promise<void> => {
		if (failed || nextIndex >= items.length) return;
		const index = nextIndex++;
		try {
			results[index] = await visit(items[index], index);
		} catch (error) {
			failed = true;
			throw error;
		}
		return work();
	};
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		work,
	);
	const settled = await Promise.allSettled(workers);
	const failure = settled.find((result) => result.status === "rejected");
	if (failure?.status === "rejected") throw failure.reason;
	return results;
}
