import type { Doc } from "../../convex/_generated/dataModel";
import type { Obra } from "./types";

export type ObraDoc = Doc<"obras">;

export function obraFromDoc(doc: ObraDoc): Obra {
	const { _id, _creationTime, ...rest } = doc;
	void _creationTime;
	return { id: _id, ...rest };
}
