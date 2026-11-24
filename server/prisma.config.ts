import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Production uses Neon's direct connection for Prisma CLI operations.
    // Local development falls back to the existing Docker DATABASE_URL.
    url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL!,
  },
})
