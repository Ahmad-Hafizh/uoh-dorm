import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig } from "@prisma/orm-postgres/config";

// Supply DATABASE_URL through your shell/deployment when connecting Neon.
// Emitting the contract does not need a database connection.
export default definePrismaConfig({
  orm: defineConfig({
    contract: "prisma/schema.prisma",
    output: "src/prisma",
    db: { connection: process.env.DATABASE_URL },
  }),
});
