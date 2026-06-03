import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const rows = await db.stoneProfile.findMany({ select: { stoneName: true, luster: true, fracture: true, cleavage: true, specificGravity: true, diaphaneity: true } });
console.log(JSON.stringify(rows, null, 2));
await db.$disconnect();
