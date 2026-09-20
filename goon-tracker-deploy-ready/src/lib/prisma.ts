import { PrismaClient } from "@prisma/client";

// A single shared instance, imported by every route module — avoids each
// file spinning up its own connection pool.
export const prisma = new PrismaClient();
