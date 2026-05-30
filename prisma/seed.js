import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding StoneProfile dictionary...`);

  // Clear existing to avoid duplicates
  await prisma.stoneProfile.deleteMany({});

  const stones = [
    {
      stoneName: 'Jasper',
      authenticity: '100% Natural Earth-Mined',
      rarity: 'Common',
      crystalSystem: 'Trigonal',
      geologicalEra: 'Various',
      mineralClass: 'Silicates (Chalcedony)',
      rockComposition: 'Silicon Dioxide (SiO2) with iron oxides',
      rockFormation: 'Sedimentary or Hydrothermal',
      hardness: '6.5 - 7.0',
      luster: 'Vitreous to Dull',
      fracture: 'Conchoidal',
      cleavage: 'None',
      specificGravity: '2.5 - 2.9',
      diaphaneity: 'Opaque'
    },
    {
      stoneName: 'Labradorite',
      authenticity: '100% Natural Earth-Mined',
      rarity: 'Uncommon',
      crystalSystem: 'Triclinic',
      geologicalEra: 'Precambrian',
      mineralClass: 'Silicates (Feldspar Group)',
      rockComposition: 'Calcium sodium aluminum silicate',
      rockFormation: 'Igneous (Mafic Rocks)',
      hardness: '6.0 - 6.5',
      luster: 'Vitreous to Pearly',
      fracture: 'Uneven to Conchoidal',
      cleavage: 'Perfect in two directions',
      specificGravity: '2.68 - 2.72',
      diaphaneity: 'Translucent to Opaque'
    },
    {
      stoneName: 'Feldspar',
      authenticity: '100% Natural Earth-Mined',
      rarity: 'Common',
      crystalSystem: 'Triclinic or Monoclinic',
      geologicalEra: 'Various',
      mineralClass: 'Silicates (Feldspar Group)',
      rockComposition: 'Potassium, sodium, or calcium aluminum silicates',
      rockFormation: 'Igneous, Metamorphic, and Sedimentary',
      hardness: '6.0 - 6.5',
      luster: 'Vitreous to Pearly',
      fracture: 'Uneven to Conchoidal',
      cleavage: 'Perfect in two directions',
      specificGravity: '2.56 - 2.76',
      diaphaneity: 'Transparent to Opaque'
    }
  ];

  for (const stone of stones) {
    const profile = await prisma.stoneProfile.create({
      data: stone,
    });
    console.log(`Created dictionary entry for: ${profile.stoneName}`);
  }

  console.log(`Seeding finished successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });