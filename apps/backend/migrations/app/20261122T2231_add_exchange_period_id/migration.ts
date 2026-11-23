#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/876081247426b2ed0d2998bf551dba538213f86dea2d83c48d8eb22fc63c599a/contract'
import startContract from '../../snapshots/876081247426b2ed0d2998bf551dba538213f86dea2d83c48d8eb22fc63c599a/contract.json' with { type: 'json' }
import type { Contract as End } from '../../snapshots/a96a3f0db9a0fb0e745a32b09053a43773aa92ce2cd05d5291c93e3caa701e30/contract'
import endContract from '../../snapshots/a96a3f0db9a0fb0e745a32b09053a43773aa92ce2cd05d5291c93e3caa701e30/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, col, fn } from '@prisma/orm-postgres/migration'

// The planner refuses the primary-key swap, so this package is authored by
// hand. Existing periods predate the id: add it with a temporary
// `gen_random_uuid()` default so Postgres fills every row, then drop the
// default (the contract generates the uuid in the ORM, not in the database).
// The natural key stays as a unique constraint.
export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ExchangePeriod',
        column: col('id', 'text', {
          notNull: true,
          default: fn('gen_random_uuid()::text'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.dropDefault({ schema: 'public', table: 'ExchangePeriod', column: 'id' }),
      this.dropConstraint({
        schema: 'public',
        table: 'ExchangePeriod',
        constraint: 'ExchangePeriod_pkey',
        kind: 'primaryKey',
      }),
      this.addPrimaryKey({
        schema: 'public',
        table: 'ExchangePeriod',
        constraint: 'ExchangePeriod_pkey',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ExchangePeriod',
        constraint: 'ExchangePeriod_occurrenceId_occurrenceYear_startsAt_endsAt_key',
        columns: ['occurrenceId', 'occurrenceYear', 'startsAt', 'endsAt'],
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
