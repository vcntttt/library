import { internal } from './_generated/api'
import { cronJobs } from 'convex/server'

const crons = cronJobs()

crons.interval(
  'check manga releases',
  { hours: 2 },
  internal.mangaReleases.checkForNewChapters,
)

export default crons
