import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
db.stoneProfile.findFirst({ where: { stoneName: { contains: 'Jasper' } } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => db.$disconnect());
