#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2f8c5ac898706fdaf0e017c0dc3ed69571cc2166d29f3f385ec34faf02aedff3/contract'
import endContract from '../../snapshots/2f8c5ac898706fdaf0e017c0dc3ed69571cc2166d29f3f385ec34faf02aedff3/contract.json' with { type: 'json' }
import type { Contract as Start } from '../../snapshots/3a05729031484f055afa16f8ec4d3c4038d0eb2bf728d855fc60fae620447b3f/contract'
import startContract from '../../snapshots/3a05729031484f055afa16f8ec4d3c4038d0eb2bf728d855fc60fae620447b3f/contract.json' with { type: 'json' }
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration'

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Class',
        column: col('vacanciesSource', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Class',
        column: col('vacanciesUpdatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
