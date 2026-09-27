// Seeds the curated "auto-donate" organizations.
// These four were chosen deliberately as low-controversy, humanitarian/medical
// Israel-support charities (not political advocacy orgs) with verified 501(c)(3)
// status and EINs as of this writing. Re-verify EINs/status periodically via
// Charity Navigator or IRS Tax Exempt Organization Search before relying on them
// in production — nonprofit status and details can change.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CURATED_ORGS = [
  {
    name: "American Friends of Magen David Adom",
    ein: "13-1790719",
    category: "Israel · Emergency medical",
    website: "https://afmda.org",
    curated: true,
  },
  {
    name: "Hadassah, The Women's Zionist Organization of America",
    ein: "13-1656651",
    category: "Israel · Hospitals",
    website: "https://www.hadassah.org",
    curated: true,
  },
  {
    name: "American Friends of Sheba Medical Center",
    ein: "23-7076117",
    category: "Israel · Hospitals",
    website: "https://www.afsmc.org",
    curated: true,
  },
  {
    name: "American Friends of Leket Israel",
    ein: "20-8202424",
    category: "Israel · Food security",
    website: "https://leketusa.org",
    curated: true,
  },
];

async function main() {
  for (const org of CURATED_ORGS) {
    await prisma.org.upsert({
      where: { id: org.ein }, // not a real unique constraint on id, see note below
      update: {},
      create: org,
    }).catch(async () => {
      // id isn't actually the ein (cuid default) — fall back to a plain create
      // guarded by a findFirst so re-running the seed doesn't duplicate rows.
      const existing = await prisma.org.findFirst({ where: { ein: org.ein } });
      if (!existing) await prisma.org.create({ data: org });
    });
  }
  console.log(`Seeded ${CURATED_ORGS.length} curated organizations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
