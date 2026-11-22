// Wire this file up after running `bun run contract:emit` at least once
// (that generates contract.json and contract.d.ts from contract.prisma).
//
// Usage: import { db } from "@/infrastructure/database/prisma" from anywhere in src/.

import postgres from '@prisma/orm-postgres/runtime'
import { ENV } from 'varlock/env'
import 'temporal-polyfill/global' // required by Prisma 8 for DateTime fields

import type { Contract } from './contract.d.ts'
import contractJson from './contract.json' with { type: 'json' }

// postgres<Contract>() creates a lazily-connected typed client. The URL comes
// from the varlock-resolved environment (`.env.schema`), so this module is only
// imported from entry points started through `varlock run`.
export const db = postgres<Contract>({ contractJson, url: ENV.DATABASE_URL })

// The inferred client type, for repositories that take the client as a
// parameter (keeps them testable and free of a module-level singleton).
export type Db = typeof db

// Call this at app startup to establish the connection eagerly.
// Optional — the client connects on first query if you skip this.
let _connection: Promise<void> | undefined
export function connectDatabase(): Promise<void> {
  _connection ??= db
    .connect()
    .then(() => undefined)
    .catch((err: unknown) => {
      _connection = undefined
      throw err
    })
  return _connection
}
