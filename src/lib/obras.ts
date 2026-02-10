import type { Doc } from "../../convex/_generated/dataModel";
import type { MetadataSource } from "./metadata/types";
import type { Obra } from "./types";

export type ObraDoc = Doc<"obras">;

export function obraFromDoc(doc: ObraDoc): Obra {
	const { _id, _creationTime, ...rest } = doc;
	const { external, ...withoutExternal } = rest;
	const { metadata, ...withoutMetadata } = withoutExternal;
	const { latestChapterSource: rawLatestChapterSource, ...metadataRest } =
		metadata ?? {};
	void _creationTime;
	const latestChapterSource =
		rawLatestChapterSource === "manga-plus" ||
		rawLatestChapterSource === "mangadex" ||
		rawLatestChapterSource === "anilist"
			? rawLatestChapterSource
			: undefined;
	return {
		id: _id,
		...withoutMetadata,
		external: external
			? {
					id: external.id,
					source: external.source as MetadataSource,
				}
			: undefined,
		metadata: metadata
			? {
					...metadataRest,
					latestChapterSource,
				}
			: undefined,
	};
}
