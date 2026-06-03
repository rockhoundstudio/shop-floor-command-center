import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const n = await db.stoneProfile.count();
console.log('ROW COUNT:', n);
await db.$disconnect();
