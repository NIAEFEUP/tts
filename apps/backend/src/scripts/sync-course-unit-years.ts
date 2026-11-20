// Copy the real curricular years from the committed catalog fixture onto an
// existing database. `CourseUnit.courseUnitYear` has no source in Postgres
// (legacy's `course_metadata` table was dropped), so the migration backfills
// every existing row with a placeholder: year 1, or 0 when the database was
// brought forward with `db:update`, which skips the migration's data transform.
//
// This is the non-destructive repair path: it updates only that one column,
// matches each unit by (courseId, acronym, semester), and touches no dependent
// row — users, planner state, exchanges, enrollments and classes are left
// alone. It runs against any DATABASE_URL, unlike `db:seed` / `db:seed:demo`,
// which truncate every table and refuse non-loopback hosts.
//
// Run: bun run catalog:sync-years

import { db } from '@/infrastructure/database/prisma'
import fixture from './fixtures/feup-leic-meic-mesw.json' with { type: 'json' }

/** A course unit's natural key — what `CourseUnit` rows are seeded from. */
function unitKey(unit: { courseId: number; acronym: string; semester: number }): string {
  return `${unit.courseId}:${unit.acronym}:${unit.semester}`
}

async function main(): Promise<void> {
  try {
    const rows = await db.orm.public.CourseUnit.select('id', 'courseId', 'acronym', 'semester', 'courseUnitYear').all()

    const rowsByKey = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = unitKey(row)
      const matching = rowsByKey.get(key)
      if (matching) matching.push(row)
      else rowsByKey.set(key, [row])
    }

    const updates: Array<{ id: number; year: number }> = []
    const unmatched: string[] = []
    const ambiguous: string[] = []

    for (const unit of fixture.courseUnits) {
      const key = unitKey(unit)
      const matching = rowsByKey.get(key)

      if (!matching) {
        unmatched.push(`${unit.acronym} (course ${unit.courseId}, semester ${unit.semester})`)
        continue
      }

      if (matching.length > 1) {
        ambiguous.push(`${key} → ids ${matching.map((row) => row.id).join(', ')}`)
        continue
      }

      const row = matching[0]
      if (row.courseUnitYear !== unit.courseUnitYear) {
        updates.push({ id: row.id, year: unit.courseUnitYear })
      }
    }

    // Abort before writing anything when the database does not line up with the
    // fixture: guessing which unit to update is worse than leaving it untouched.
    if (unmatched.length > 0 || ambiguous.length > 0) {
      const problems = [
        unmatched.length > 0 ? `no matching CourseUnit for:\n  ${unmatched.join('\n  ')}` : '',
        ambiguous.length > 0 ? `ambiguous natural key for:\n  ${ambiguous.join('\n  ')}` : '',
      ].filter(Boolean)

      throw new Error(`Cannot sync catalog years — ${problems.join('\n')}`)
    }

    if (updates.length > 0) {
      await db.transaction(async (tx) => {
        for (const update of updates) {
          await tx.orm.public.CourseUnit.where({ id: update.id }).update({ courseUnitYear: update.year })
        }
      })
    }

    console.log(
      `Catalog years synced: ${updates.length} updated, ` +
        `${fixture.courseUnits.length - updates.length} already correct.`,
    )
  } finally {
    await db.close()
  }
}

await main()
