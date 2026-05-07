import { PrismaClient } from "@prisma/client";

// ==========================================
// ENGINE: DATABASE CONNECTION (PRISMA)
// ==========================================
// This file manages the primary connection to your database.
// We use a global variable in development mode to prevent Remix's 
// hot-reloading from opening too many database connections and stalling the engine.

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
  prisma = global.prismaGlobal;
}

export default prisma;