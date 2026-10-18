import { PrismaClient } from "@prisma/client"
import { loadEnv } from "./env"
import { cleanup } from "./db"

loadEnv()

export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    await cleanup(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
