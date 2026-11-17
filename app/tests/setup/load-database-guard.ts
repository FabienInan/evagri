// Fichier de setup Vitest : vérifie la base avant que les tests n'y touchent.
import { assertLocalTestDatabase, readEnvFileValue } from "./database-guard"

const databaseUrl = process.env.DATABASE_URL ?? readEnvFileValue("DATABASE_URL")
assertLocalTestDatabase(databaseUrl, process.env.ALLOW_REMOTE_TEST_DB === "1")
