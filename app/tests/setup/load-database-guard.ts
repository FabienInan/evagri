// Fichier de setup Vitest : vérifie la base avant que les tests n'y touchent.
import { assertLocalTestDatabase, readEnvFileValue } from "./database-guard"

const databaseUrl = process.env.DATABASE_URL ?? readEnvFileValue("DATABASE_URL")
// Prisma 7 connects through an adapter that reads process.env, not the .env file: expose the value to the tests.
process.env.DATABASE_URL ??= databaseUrl
assertLocalTestDatabase(databaseUrl, process.env.ALLOW_REMOTE_TEST_DB === "1")
