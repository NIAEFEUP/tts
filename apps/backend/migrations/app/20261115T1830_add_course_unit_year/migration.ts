#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/876081247426b2ed0d2998bf551dba538213f86dea2d83c48d8eb22fc63c599a/contract'
import endContract from '../../snapshots/876081247426b2ed0d2998bf551dba538213f86dea2d83c48d8eb22fc63c599a/contract.json' with { type: 'json' }
import type { Contract as Start } from '../../snapshots/b8cf88cef780e6a64cd5f17b631daf8ea2da908d6e3abc62b0300743cbb65fb5/contract'
import startContract from '../../snapshots/b8cf88cef780e6a64cd5f17b631daf8ea2da908d6e3abc62b0300743cbb65fb5/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration'
import postgres from '@prisma/orm-postgres/runtime'

// The contract stores a `NOT NULL` column, but the existing rows have no
// curricular year to copy from: `course_metadata` lives in the scraper's SQLite
// dump, not in Postgres. Seed every existing unit as year 1 and let the next
// catalog seed/re-sync overwrite it with the real value.
const { sql: db, contract } = postgres<End>({ contractJson: endContract })

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'CourseUnit',
        column: col('courseUnitYear', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dataTransform(contract, 'backfill-CourseUnit-courseUnitYear', {
        check: () =>
          db.public.CourseUnit.select('id')
            .where((unit, fns) => fns.eq(unit.courseUnitYear, null))
            .limit(1),
        run: () =>
          db.public.CourseUnit.update({ courseUnitYear: 1 }).where((unit, fns) => fns.eq(unit.courseUnitYear, null)),
      }),
      this.setNotNull({ schema: 'public', table: 'CourseUnit', column: 'courseUnitYear' }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
