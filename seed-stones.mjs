import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  await db.stoneProfile.upsert({
    where: { stoneName: 'Jasper' },
    update: { hardness: '6.5-7', luster: 'Waxy to Dull', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.58-2.91', diaphaneity: 'Opaque' },
    create: { stoneName: 'Jasper', hardness: '6.5-7', luster: 'Waxy to Dull', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.58-2.91', diaphaneity: 'Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Agate' },
    update: { hardness: '6.5-7', luster: 'Waxy', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.58-2.64', diaphaneity: 'Translucent' },
    create: { stoneName: 'Agate', hardness: '6.5-7', luster: 'Waxy', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.58-2.64', diaphaneity: 'Translucent' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Labradorite' },
    update: { hardness: '6-6.5', luster: 'Vitreous to Pearly', fracture: 'Uneven to Conchoidal', cleavage: 'Perfect', specificGravity: '2.68-2.72', diaphaneity: 'Translucent to Opaque' },
    create: { stoneName: 'Labradorite', hardness: '6-6.5', luster: 'Vitreous to Pearly', fracture: 'Uneven to Conchoidal', cleavage: 'Perfect', specificGravity: '2.68-2.72', diaphaneity: 'Translucent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Obsidian' },
    update: { hardness: '5-5.5', luster: 'Vitreous', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.35-2.60', diaphaneity: 'Translucent to Opaque' },
    create: { stoneName: 'Obsidian', hardness: '5-5.5', luster: 'Vitreous', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.35-2.60', diaphaneity: 'Translucent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Variscite' },
    update: { hardness: '3.5-5', luster: 'Waxy to Dull', fracture: 'Uneven to Conchoidal', cleavage: 'Perfect', specificGravity: '2.57-2.61', diaphaneity: 'Translucent to Opaque' },
    create: { stoneName: 'Variscite', hardness: '3.5-5', luster: 'Waxy to Dull', fracture: 'Uneven to Conchoidal', cleavage: 'Perfect', specificGravity: '2.57-2.61', diaphaneity: 'Translucent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Serpentine' },
    update: { hardness: '2.5-5.5', luster: 'Greasy, Waxy, or Silky', fracture: 'Subconchoidal to Uneven', cleavage: 'None', specificGravity: '2.44-2.62', diaphaneity: 'Translucent to Opaque' },
    create: { stoneName: 'Serpentine', hardness: '2.5-5.5', luster: 'Greasy, Waxy, or Silky', fracture: 'Subconchoidal to Uneven', cleavage: 'None', specificGravity: '2.44-2.62', diaphaneity: 'Translucent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Quartzite' },
    update: { hardness: '7', luster: 'Vitreous to Greasy', fracture: 'Uneven to Conchoidal', cleavage: 'None', specificGravity: '2.64-2.69', diaphaneity: 'Translucent to Opaque' },
    create: { stoneName: 'Quartzite', hardness: '7', luster: 'Vitreous to Greasy', fracture: 'Uneven to Conchoidal', cleavage: 'None', specificGravity: '2.64-2.69', diaphaneity: 'Translucent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Andesite' },
    update: { hardness: '5-6', luster: 'Dull', fracture: 'Uneven', cleavage: 'None', specificGravity: '2.5-2.8', diaphaneity: 'Opaque' },
    create: { stoneName: 'Andesite', hardness: '5-6', luster: 'Dull', fracture: 'Uneven', cleavage: 'None', specificGravity: '2.5-2.8', diaphaneity: 'Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Feldspar' },
    update: { hardness: '6-6.5', luster: 'Vitreous to Pearly', fracture: 'Uneven to Conchoidal', cleavage: 'Perfect', specificGravity: '2.55-2.76', diaphaneity: 'Transparent to Opaque' },
    create: { stoneName: 'Feldspar', hardness: '6-6.5', luster: 'Vitreous to Pearly', fracture: 'Uneven to Conchoidal', cleavage: 'Perfect', specificGravity: '2.55-2.76', diaphaneity: 'Transparent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Quartz' },
    update: { hardness: '7', luster: 'Vitreous', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.65', diaphaneity: 'Transparent to Opaque' },
    create: { stoneName: 'Quartz', hardness: '7', luster: 'Vitreous', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.65', diaphaneity: 'Transparent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Hornblende' },
    update: { hardness: '5-6', luster: 'Vitreous to Dull', fracture: 'Uneven', cleavage: 'Perfect', specificGravity: '3.0-3.5', diaphaneity: 'Opaque' },
    create: { stoneName: 'Hornblende', hardness: '5-6', luster: 'Vitreous to Dull', fracture: 'Uneven', cleavage: 'Perfect', specificGravity: '3.0-3.5', diaphaneity: 'Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Ironstone' },
    update: { hardness: '5-6.5', luster: 'Earthy to Submetallic', fracture: 'Uneven', cleavage: 'None', specificGravity: '3.3-3.8', diaphaneity: 'Opaque' },
    create: { stoneName: 'Ironstone', hardness: '5-6.5', luster: 'Earthy to Submetallic', fracture: 'Uneven', cleavage: 'None', specificGravity: '3.3-3.8', diaphaneity: 'Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Aventurine' },
    update: { hardness: '6.5-7', luster: 'Vitreous to Glistening', fracture: 'Uneven to Conchoidal', cleavage: 'None', specificGravity: '2.64-2.69', diaphaneity: 'Translucent to Opaque' },
    create: { stoneName: 'Aventurine', hardness: '6.5-7', luster: 'Vitreous to Glistening', fracture: 'Uneven to Conchoidal', cleavage: 'None', specificGravity: '2.64-2.69', diaphaneity: 'Translucent to Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Rhyolite' },
    update: { hardness: '6', luster: 'Dull', fracture: 'Uneven', cleavage: 'None', specificGravity: '2.4-2.6', diaphaneity: 'Opaque' },
    create: { stoneName: 'Rhyolite', hardness: '6', luster: 'Dull', fracture: 'Uneven', cleavage: 'None', specificGravity: '2.4-2.6', diaphaneity: 'Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Basalt' },
    update: { hardness: '5-6', luster: 'Dull', fracture: 'Uneven', cleavage: 'None', specificGravity: '2.8-3.0', diaphaneity: 'Opaque' },
    create: { stoneName: 'Basalt', hardness: '5-6', luster: 'Dull', fracture: 'Uneven', cleavage: 'None', specificGravity: '2.8-3.0', diaphaneity: 'Opaque' },
  });

  await db.stoneProfile.upsert({
    where: { stoneName: 'Petrified Wood' },
    update: { hardness: '6.5-7', luster: 'Waxy to Dull', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.58-2.91', diaphaneity: 'Opaque' },
    create: { stoneName: 'Petrified Wood', hardness: '6.5-7', luster: 'Waxy to Dull', fracture: 'Conchoidal', cleavage: 'None', specificGravity: '2.58-2.91', diaphaneity: 'Opaque' },
  });
}

main().finally(() => db.$disconnect());