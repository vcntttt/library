import { cronJobs, makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"check manga releases",
	{ hours: 2 },
	internal.notifications.checkForNewChapters,
	{},
);

crons.interval(
	"check episodic releases",
	{ hours: 2 },
	internal.notifications.checkForNewEpisodes,
	{},
);

crons.interval(
	"sync stremio libraries",
	{ minutes: 5 },
	makeFunctionReference<"action", Record<string, never>, null>(
		"stremio:syncDue",
	),
	{},
);

export default crons;
