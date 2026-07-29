import { cronJobs } from "convex/server";
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

export default crons;
