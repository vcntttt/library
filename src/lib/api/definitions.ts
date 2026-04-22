import type {
	CreateObraInput,
	Obra,
	ObraStatus,
	ObraType,
	UpdateObraPatch,
} from "@/lib/types";

export interface QueryDescriptor<TArgs, TData> {
	kind: "query";
	path: (args: TArgs) => string;
	queryKey: (args: TArgs) => readonly unknown[];
	refetchInterval?: number;
	refetchIntervalInBackground?: boolean;
	__response?: TData;
}

export interface MutationDescriptor<TArgs, TData> {
	kind: "mutation";
	method: "POST" | "PATCH" | "DELETE";
	path: (args: TArgs) => string;
	body?: (args: TArgs) => unknown;
	invalidate: readonly unknown[];
	__response?: TData;
}

function defineQuery<TArgs, TData>(descriptor: QueryDescriptor<TArgs, TData>) {
	return descriptor;
}

function defineMutation<TArgs, TData>(
	descriptor: MutationDescriptor<TArgs, TData>,
) {
	return descriptor;
}

export interface ListObrasArgs {
	status?: ObraStatus;
	type?: ObraType;
	limit?: number;
}

export interface GetObraArgs {
	id: string;
}

export interface UpdateObraArgs {
	id: string;
	patch: UpdateObraPatch;
}

export interface RemoveObraArgs {
	id: string;
}

function withSearchParams(path: string, values: object) {
	const url = new URL(path, "http://localhost");
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, String(value));
		}
	}

	const search = url.searchParams.toString();
	return search ? `${path}?${search}` : path;
}

export const api = {
	obras: {
		list: defineQuery<ListObrasArgs, Obra[]>({
			kind: "query",
			path: (args: ListObrasArgs) => withSearchParams("/api/obras", args),
			queryKey: (args: ListObrasArgs) => ["obras", "list", args] as const,
			refetchInterval: 15_000,
			refetchIntervalInBackground: true,
		}),
		get: defineQuery<GetObraArgs, Obra | null>({
			kind: "query",
			path: ({ id }: GetObraArgs) => `/api/obras/${id}`,
			queryKey: ({ id }: GetObraArgs) => ["obras", "detail", id] as const,
			refetchInterval: 15_000,
			refetchIntervalInBackground: true,
		}),
		create: defineMutation<CreateObraInput, Obra>({
			kind: "mutation",
			method: "POST",
			path: () => "/api/obras",
			body: (args: CreateObraInput) => args,
			invalidate: ["obras"],
		}),
		update: defineMutation<UpdateObraArgs, Obra>({
			kind: "mutation",
			method: "PATCH",
			path: ({ id }: UpdateObraArgs) => `/api/obras/${id}`,
			body: ({ patch }: UpdateObraArgs) => ({ patch }),
			invalidate: ["obras"],
		}),
		remove: defineMutation<RemoveObraArgs, { id: string }>({
			kind: "mutation",
			method: "DELETE",
			path: ({ id }: RemoveObraArgs) => `/api/obras/${id}`,
			invalidate: ["obras"],
		}),
	},
};
