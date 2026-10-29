import { definePrismaConfig } from 'prisma/config'
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config'

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/infrastructure/database/contract.prisma',
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
})
