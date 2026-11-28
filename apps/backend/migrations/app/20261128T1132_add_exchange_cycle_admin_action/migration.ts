#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2f8c5ac898706fdaf0e017c0dc3ed69571cc2166d29f3f385ec34faf02aedff3/contract'
import startContract from '../../snapshots/2f8c5ac898706fdaf0e017c0dc3ed69571cc2166d29f3f385ec34faf02aedff3/contract.json' with { type: 'json' }
import type { Contract as End } from '../../snapshots/71b00e7b7906404008b30d1d10ef74875ae74f6d6d1e22eaf66878053fc96c5f/contract'
import endContract from '../../snapshots/71b00e7b7906404008b30d1d10ef74875ae74f6d6d1e22eaf66878053fc96c5f/contract.json' with { type: 'json' }
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
          onDelete: 'restrict',
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
