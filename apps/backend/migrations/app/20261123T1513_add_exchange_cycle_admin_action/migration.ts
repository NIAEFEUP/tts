#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3a05729031484f055afa16f8ec4d3c4038d0eb2bf728d855fc60fae620447b3f/contract'
import startContract from '../../snapshots/3a05729031484f055afa16f8ec4d3c4038d0eb2bf728d855fc60fae620447b3f/contract.json' with { type: 'json' }
import type { Contract as End } from '../../snapshots/e3247dcc2cec972220caa5a51bb09c7074cbe8748eb8012d2dd26a52963de815/contract'
import endContract from '../../snapshots/e3247dcc2cec972220caa5a51bb09c7074cbe8748eb8012d2dd26a52963de815/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, checkExpression, col, fn, primaryKey } from '@prisma/orm-postgres/migration'

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        columns: [
          col('adminId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('cycleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fromState', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('toState', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ExchangeCycleAdminAction_fromState_check_b8f510ef',
            `"fromState" IN ('UNTREATED', 'TREATED', 'REJECTED', 'AWAITING_INFORMATION')`,
          ),
          checkExpression(
            'ExchangeCycleAdminAction_toState_check_99abb6fe',
            `"toState" IN ('UNTREATED', 'TREATED', 'REJECTED', 'AWAITING_INFORMATION')`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        index: 'ExchangeCycleAdminAction_adminId_createdAt_idx_5015ed56',
        columns: ['adminId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        index: 'ExchangeCycleAdminAction_adminId_idx_530179db',
        columns: ['adminId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        index: 'ExchangeCycleAdminAction_cycleId_createdAt_idx_e886fe67',
        columns: ['cycleId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        index: 'ExchangeCycleAdminAction_cycleId_idx_75f87b79',
        columns: ['cycleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        foreignKey: {
          name: 'ExchangeCycleAdminAction_cycleId_fkey',
          columns: ['cycleId'],
          references: { schema: 'public', table: 'ExchangeCycle', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeCycleAdminAction',
        foreignKey: {
          name: 'ExchangeCycleAdminAction_adminId_fkey',
          columns: ['adminId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
