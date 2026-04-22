import {
	useQueryClient,
	useMutation as useTanstackMutation,
	useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import type { MutationDescriptor, QueryDescriptor } from "./definitions";

export function useQuery<TArgs, TData>(
	descriptor: QueryDescriptor<TArgs, TData>,
	args: TArgs,
) {
	const query = useTanstackQuery({
		queryKey: descriptor.queryKey(args),
		queryFn: () => requestJson<TData>(descriptor.path(args)),
		refetchInterval: descriptor.refetchInterval,
		refetchIntervalInBackground: descriptor.refetchIntervalInBackground,
	});

	return query.data;
}

export function useMutation<TArgs, TData>(
	descriptor: MutationDescriptor<TArgs, TData>,
) {
	const queryClient = useQueryClient();
	const mutation = useTanstackMutation({
		mutationFn: (args: TArgs) =>
			requestJson<TData>(descriptor.path(args), {
				method: descriptor.method,
				body: descriptor.body?.(args),
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: descriptor.invalidate });
		},
	});

	return mutation.mutateAsync;
}

async function requestJson<TData>(
	path: string,
	init?: { method?: string; body?: unknown },
) {
	const response = await fetch(path, {
		method: init?.method ?? "GET",
		headers: {
			"content-type": "application/json",
		},
		body:
			init?.body === undefined
				? undefined
				: JSON.stringify(init.body, (_key, value) =>
						value === undefined ? null : value,
					),
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(payload?.error ?? "Request fallido.");
	}

	if (response.status === 204) {
		return null as TData;
	}

	return (await response.json()) as TData;
}
