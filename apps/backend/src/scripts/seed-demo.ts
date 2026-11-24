// Seed the catalog plus a mock layer for the exchange flows: an admin and a
// student roster, classes and enrollments, open exchange windows, sample
// exchanges covering every type / status, and enrollment requests. The mock
// layer covers L.EIC and M.EIC only.
//
// Run: bun run db:seed:demo
//
// This truncates every table and rebuilds catalog + demo. `bun run db:seed`
// would truncate too and leave the demo tables empty — always finish with this
// script if you want exchanges. See `seed-core.ts` for the implementation.

import { runSeed } from './seed-core'

const { catalog, demo } = await runSeed({ demo: true })
if (!demo) throw new Error('demo summary missing')

console.log(
  `Seeded ${catalog.courses} courses, ${catalog.courseUnits} course units, ` +
    `${catalog.occurrences} occurrences.\n` +
    `Demo: ${demo.users} users, ${demo.classes} classes, ${demo.enrollments} enrollments, ` +
    `${demo.exchangePeriods} exchange periods, ` +
    `${demo.exchangeOffers} exchange offers (${demo.exchangeCycles} cycles, ` +
    `${demo.exchangeParticipants} participants, ${demo.exchangeSources} sources, ${demo.exchangeItems} items), ` +
    `${demo.enrollmentRequests} enrollment requests (${demo.enrollmentRequestOptions} options), ` +
    `admin scope on ${demo.adminCourses} courses / ${demo.adminOccurrences} occurrences.`,
)
