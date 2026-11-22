import { definePrismaConfig } from 'prisma/config'
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config'

// The Prisma CLI loads this file before any application code, and some commands
// (`bun run contract:emit`, `bun run migration:plan`) deliberately run without
// `varlock run` because they need no database. Reading `process.env` here is
// therefore intentional: a typed `ENV` read would throw when varlock has not
// initialised. Application code under `src/` uses the typed `ENV` instead.
export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/infrastructure/database/contract.prisma',
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
})
