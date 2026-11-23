#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3a05729031484f055afa16f8ec4d3c4038d0eb2bf728d855fc60fae620447b3f/contract'
import endContract from '../../snapshots/3a05729031484f055afa16f8ec4d3c4038d0eb2bf728d855fc60fae620447b3f/contract.json' with { type: 'json' }
import type { Contract as Start } from '../../snapshots/8bb43f0b67bb9088d07dd8f34bccaa1bb45027e27e92c846d4966fa7c568b9c4/contract'
import startContract from '../../snapshots/8bb43f0b67bb9088d07dd8f34bccaa1bb45027e27e92c846d4966fa7c568b9c4/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, col, lit, rawSql } from '@prisma/orm-postgres/migration'
import postgres from '@prisma/orm-postgres/runtime'
import 'temporal-polyfill/types/global'

const { sql: db, contract } = postgres<End>({ contractJson: endContract })

// ExchangeItem.accepted -> status (#965). The planner cannot infer the
// accepted -> ACCEPTED backfill, and the typed dataTransform builder is built
// against the end contract, where `accepted` no longer exists — so a rawSql
// op carries it between the status addColumn and the accepted dropColumn.
// A second rawSql op copies the accept timestamp from ExchangeParticipant
// (keyed by cycleId + userId) onto the accepted items, so ACCEPTED rows keep
// their "accepted at" instead of starting at NULL; participants without a
// timestamp stay NULL. Rows left at the column default PENDING are already
// correct; updatedAt is NOT NULL with no default, so it lands nullable, is
// backfilled, then gains NOT NULL.
export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_userId_accepted_idx_b8232572',
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeItem',
        column: col('acceptedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeItem',
        column: col('status', 'text', {
          notNull: true,
          default: lit('PENDING'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      rawSql({
        id: 'data_migration.backfill-exchange-item-status',
        label: 'Data transform: backfill-exchange-item-status',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [
          {
            description: 'Check backfill-exchange-item-status has work to do',
            sql: 'SELECT EXISTS (SELECT 1 FROM "public"."ExchangeItem" WHERE "accepted" = true AND "status" <> \'ACCEPTED\' LIMIT 1) AS ok',
            params: [],
          },
        ],
        execute: [
          {
            description: 'Run backfill-exchange-item-status',
            sql: 'UPDATE "public"."ExchangeItem" SET "status" = \'ACCEPTED\' WHERE "accepted" = true',
            params: [],
          },
        ],
        postcheck: [
          {
            description: 'Verify backfill-exchange-item-status resolved all violations',
            sql: 'SELECT NOT EXISTS (SELECT 1 FROM "public"."ExchangeItem" WHERE "accepted" = true AND "status" <> \'ACCEPTED\' LIMIT 1) AS ok',
            params: [],
          },
        ],
      }),
      rawSql({
        id: 'data_migration.backfill-exchange-item-acceptedAt',
        label: 'Data transform: backfill-exchange-item-acceptedAt',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [
          {
            description: 'Check backfill-exchange-item-acceptedAt has work to do',
            sql: 'SELECT EXISTS (SELECT 1 FROM "public"."ExchangeItem" AS i INNER JOIN "public"."ExchangeParticipant" AS p ON p."cycleId" = i."cycleId" AND p."userId" = i."userId" WHERE i."accepted" = true AND i."acceptedAt" IS NULL AND p."acceptedAt" IS NOT NULL LIMIT 1) AS ok',
            params: [],
          },
        ],
        execute: [
          {
            description: 'Run backfill-exchange-item-acceptedAt',
            sql: 'UPDATE "public"."ExchangeItem" AS i SET "acceptedAt" = p."acceptedAt" FROM "public"."ExchangeParticipant" AS p WHERE p."cycleId" = i."cycleId" AND p."userId" = i."userId" AND i."accepted" = true AND i."acceptedAt" IS NULL AND p."acceptedAt" IS NOT NULL',
            params: [],
          },
        ],
        postcheck: [
          {
            description: 'Verify backfill-exchange-item-acceptedAt resolved all violations',
            sql: 'SELECT NOT EXISTS (SELECT 1 FROM "public"."ExchangeItem" AS i INNER JOIN "public"."ExchangeParticipant" AS p ON p."cycleId" = i."cycleId" AND p."userId" = i."userId" WHERE i."accepted" = true AND i."acceptedAt" IS NULL AND p."acceptedAt" IS NOT NULL LIMIT 1) AS ok',
            params: [],
          },
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeItem',
        column: col('statusReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeItem',
        column: col('updatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.dataTransform(contract, 'backfill-ExchangeItem-updatedAt', {
        check: () =>
          db.public.ExchangeItem.select('cycleId')
            .where((f, fns) => fns.eq(f.updatedAt, null))
            .limit(1),
        run: () =>
          db.public.ExchangeItem.update({ updatedAt: Temporal.Now.instant() }).where((f, fns) =>
            fns.eq(f.updatedAt, null),
          ),
      }),
      this.setNotNull({ schema: 'public', table: 'ExchangeItem', column: 'updatedAt' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ExchangeItem',
        constraint: 'ExchangeItem_status_check_6810de43',
        expression: `"status" IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'INVALID')`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_cycleId_status_idx_437fba2a',
        columns: ['cycleId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.dropColumn({ schema: 'public', table: 'ExchangeItem', column: 'accepted' }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
