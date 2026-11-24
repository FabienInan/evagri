import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loadEnv } from "./env"
import { cleanup } from "./db"

loadEnv()

export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  try {
    await cleanup(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
