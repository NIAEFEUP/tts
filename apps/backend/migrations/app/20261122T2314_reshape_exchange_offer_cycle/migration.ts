#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0fc628ccc2fc1196b437ee7bd65f02d531959a76cf7aca071066c7bb35eca3ff/contract'
import startContract from '../../snapshots/0fc628ccc2fc1196b437ee7bd65f02d531959a76cf7aca071066c7bb35eca3ff/contract.json' with { type: 'json' }
import type { Contract as End } from '../../snapshots/8bb43f0b67bb9088d07dd8f34bccaa1bb45027e27e92c846d4966fa7c568b9c4/contract'
import endContract from '../../snapshots/8bb43f0b67bb9088d07dd8f34bccaa1bb45027e27e92c846d4966fa7c568b9c4/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration'
import postgres from '@prisma/orm-postgres/runtime'

const { sql: db, contract } = postgres<End>({ contractJson: endContract })

// The planner refuses the ExchangeItem primary-key swap, so this package is
// authored by hand.
//
// No live exchange data exists (no exchange route is mounted yet), and the new
// offer move cannot be derived from the old request-owned items, so the
// migration clears the exchange tables first. That also lets the new NOT NULL
// columns be added directly. `bun run db:seed:demo` rebuilds the demo data.
export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      // Clears any rows created before the reshape. The two deletes use the
      // old FK graph: deleting a cycle cascades to its participants and
      // sources, and deleting a request then cascades to its items.
      this.dataTransform(contract, 'clear-exchange-cycles', {
        check: () => db.public.ExchangeCycle.select('id').limit(1),
        run: () => db.public.ExchangeCycle.delete(),
      }),
      this.dataTransform(contract, 'clear-exchange-requests', {
        check: () => db.public.ExchangeRequest.select('id').limit(1),
        run: () => db.public.ExchangeRequest.delete(),
      }),

      // ExchangeRequest: the request becomes an offer carrying its own move.
      this.dropCheckConstraint({
        schema: 'public',
        table: 'ExchangeRequest',
        constraint: 'ExchangeRequest_status_check_a8137f16',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'ExchangeRequest',
        constraint: 'ExchangeRequest_adminState_check_49a4ff70',
      }),
      this.dropColumn({ schema: 'public', table: 'ExchangeRequest', column: 'adminState' }),
      this.dropColumn({ schema: 'public', table: 'ExchangeRequest', column: 'hash' }),
      this.dropColumn({ schema: 'public', table: 'ExchangeRequest', column: 'lastValidated' }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeRequest',
        column: col('occurrenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeRequest',
        column: col('occurrenceYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeRequest',
        column: col('fromClassId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeRequest',
        column: col('toClassId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dropDefault({ schema: 'public', table: 'ExchangeRequest', column: 'status' }),
      this.setDefault({
        schema: 'public',
        table: 'ExchangeRequest',
        column: col('status', 'text', {
          notNull: true,
          default: lit('OPEN'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ExchangeRequest',
        constraint: 'ExchangeRequest_status_check_07c2ff7d',
        expression: `"status" IN ('OPEN', 'MATCHED', 'CANCELLED', 'EXPIRED')`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_occurrenceId_occurrenceYear_idx_0f44eca6',
        columns: ['occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_fromClassId_occurrenceId_occurrenceYea_a94b3366',
        columns: ['fromClassId', 'occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeRequest',
        index: 'ExchangeRequest_toClassId_occurrenceId_occurrenceYear__47ff9320',
        columns: ['toClassId', 'occurrenceId', 'occurrenceYear'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeRequest',
        foreignKey: {
          name: 'ExchangeRequest_occurrenceId_occurrenceYear_fkey',
          columns: ['occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Occurrence', columns: ['id', 'year'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeRequest',
        foreignKey: {
          name: 'ExchangeRequest_fromClassId_occurrenceId_occurrenceYear_fkey',
          columns: ['fromClassId', 'occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Class', columns: ['id', 'occurrenceId', 'occurrenceYear'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeRequest',
        foreignKey: {
          name: 'ExchangeRequest_toClassId_occurrenceId_occurrenceYear_fkey',
          columns: ['toClassId', 'occurrenceId', 'occurrenceYear'],
          references: { schema: 'public', table: 'Class', columns: ['id', 'occurrenceId', 'occurrenceYear'] },
        },
      }),

      // ExchangeItem: the moves now belong to the cycle.
      this.dropConstraint({
        schema: 'public',
        table: 'ExchangeItem',
        constraint: 'ExchangeItem_pkey',
        kind: 'primaryKey',
      }),
      this.addColumn({
        schema: 'public',
        table: 'ExchangeItem',
        column: col('cycleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropColumn({ schema: 'public', table: 'ExchangeItem', column: 'requestId' }),
      this.addPrimaryKey({
        schema: 'public',
        table: 'ExchangeItem',
        constraint: 'ExchangeItem_pkey',
        columns: ['cycleId', 'userId', 'occurrenceId', 'occurrenceYear'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeItem',
        index: 'ExchangeItem_cycleId_idx_75f87b79',
        columns: ['cycleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeItem',
        foreignKey: {
          name: 'ExchangeItem_cycleId_fkey',
          columns: ['cycleId'],
          references: { schema: 'public', table: 'ExchangeCycle', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
