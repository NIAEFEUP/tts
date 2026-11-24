#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0fc628ccc2fc1196b437ee7bd65f02d531959a76cf7aca071066c7bb35eca3ff/contract'
import endContract from '../../snapshots/0fc628ccc2fc1196b437ee7bd65f02d531959a76cf7aca071066c7bb35eca3ff/contract.json' with { type: 'json' }
import type { Contract as Start } from '../../snapshots/a96a3f0db9a0fb0e745a32b09053a43773aa92ce2cd05d5291c93e3caa701e30/contract'
import startContract from '../../snapshots/a96a3f0db9a0fb0e745a32b09053a43773aa92ce2cd05d5291c93e3caa701e30/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, checkExpression, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration'

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ExchangeCycle',
        columns: [
          col('adminState', 'text', {
            notNull: true,
            default: lit('UNTREATED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('hash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastValidatedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('origin', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ExchangeCycle_adminState_check_49a4ff70',
            `"adminState" IN ('UNTREATED', 'TREATED', 'REJECTED', 'AWAITING_INFORMATION')`,
          ),
          checkExpression(
            'ExchangeCycle_origin_check_65c9d028',
            `"origin" IN ('DIRECT', 'MARKETPLACE', 'URGENT', 'AUTO_MATCH')`,
          ),
          checkExpression('ExchangeCycle_status_check_a8137f16', `"status" IN ('PENDING', 'ACCEPTED', 'CANCELLED')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ExchangeCycleSource',
        columns: [
          col('cycleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['cycleId', 'requestId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ExchangeParticipant',
        columns: [
          col('acceptedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('cycleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['cycleId', 'userId'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycle',
        index: 'ExchangeCycle_adminState_createdAt_idx_3ef72936',
        columns: ['adminState', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycle',
        index: 'ExchangeCycle_hash_idx_d25bc543',
        columns: ['hash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycle',
        index: 'ExchangeCycle_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycleSource',
        index: 'ExchangeCycleSource_cycleId_idx_75f87b79',
        columns: ['cycleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeCycleSource',
        index: 'ExchangeCycleSource_requestId_idx_fd667f92',
        columns: ['requestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeParticipant',
        index: 'ExchangeParticipant_cycleId_idx_75f87b79',
        columns: ['cycleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ExchangeParticipant',
        index: 'ExchangeParticipant_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeCycleSource',
        foreignKey: {
          name: 'ExchangeCycleSource_cycleId_fkey',
          columns: ['cycleId'],
          references: { schema: 'public', table: 'ExchangeCycle', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeCycleSource',
        foreignKey: {
          name: 'ExchangeCycleSource_requestId_fkey',
          columns: ['requestId'],
          references: { schema: 'public', table: 'ExchangeRequest', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeParticipant',
        foreignKey: {
          name: 'ExchangeParticipant_cycleId_fkey',
          columns: ['cycleId'],
          references: { schema: 'public', table: 'ExchangeCycle', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ExchangeParticipant',
        foreignKey: {
          name: 'ExchangeParticipant_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
