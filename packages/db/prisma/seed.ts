import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const funders: { name: string; slug: string; type: string; notes?: string }[] = [
  { name: "Rasmuson Foundation", slug: "rasmuson-foundation", type: "PRIVATE_FOUNDATION" },
  {
    name: "The Alaska Community Foundation",
    slug: "alaska-community-foundation",
    type: "COMMUNITY_FOUNDATION",
    notes: "Curator to confirm which local affiliates serve Southeast Alaska.",
  },
  {
    name: "Juneau Community Foundation",
    slug: "juneau-community-foundation",
    type: "COMMUNITY_FOUNDATION",
  },
  {
    name: "M.J. Murdock Charitable Trust",
    slug: "mj-murdock-charitable-trust",
    type: "PRIVATE_FOUNDATION",
  },
  {
    name: "Alaska Mental Health Trust Authority",
    slug: "alaska-mental-health-trust-authority",
    type: "STATE",
  },
  {
    name: "Alaska Conservation Foundation",
    slug: "alaska-conservation-foundation",
    type: "NONPROFIT_INTERMEDIARY",
  },
  {
    name: "Sealaska Heritage Institute",
    slug: "sealaska-heritage-institute",
    type: "NONPROFIT_INTERMEDIARY",
  },
  { name: "Sealaska", slug: "sealaska", type: "ANCSA_CORPORATION" },
  {
    name: "Spruce Root",
    slug: "spruce-root",
    type: "CDFI_LENDER",
    notes: "Verify the funder type.",
  },
  {
    name: "First Alaskans Institute",
    slug: "first-alaskans-institute",
    type: "NONPROFIT_INTERMEDIARY",
  },
  {
    name: "Alaska State Council on the Arts",
    slug: "alaska-state-council-on-the-arts",
    type: "STATE",
  },
  {
    name: "Alaska Humanities Forum",
    slug: "alaska-humanities-forum",
    type: "NONPROFIT_INTERMEDIARY",
  },
  {
    name: "Alaska DCCED, Division of Community and Regional Affairs",
    slug: "alaska-dcced-dcra",
    type: "STATE",
  },
  { name: "Denali Commission", slug: "denali-commission", type: "FEDERAL" },
  { name: "USDA Rural Development", slug: "usda-rural-development", type: "FEDERAL" },
  { name: "U.S. Economic Development Administration", slug: "eda", type: "FEDERAL" },
  { name: "NOAA", slug: "noaa", type: "FEDERAL" },
  { name: "USDA Forest Service", slug: "usda-forest-service", type: "FEDERAL" },
  {
    name: "HHS Administration for Native Americans",
    slug: "hhs-administration-for-native-americans",
    type: "FEDERAL",
  },
  { name: "Bureau of Indian Affairs", slug: "bureau-of-indian-affairs", type: "FEDERAL" },
  {
    name: "City and borough community grant programs",
    slug: "city-borough-community-grant-programs",
    type: "LOCAL_GOVERNMENT",
    notes:
      "Replace with one record per municipality after the curator researches which cities run a program.",
  },
];

const settings: { key: string; value: string; description: string; sourceUrl?: string }[] = [
  {
    key: "SINGLE_AUDIT_THRESHOLD_USD",
    value: "1000000",
    description: "Per 2 CFR 200.501 as revised in 2024. Verify the current value.",
    sourceUrl:
      "https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-F/section-200.501",
  },
  {
    key: "VOLUNTEER_HOUR_RATE_USD",
    value: "",
    description: "Set from Independent Sector's current Alaska figure. Used in Phase 3.",
  },
  {
    key: "DEFAULT_INTERNAL_BUFFER_BUSINESS_DAYS",
    value: "3",
    description: "Business days subtracted from a funder deadline to suggest an internal due date.",
  },
  {
    key: "OPPORTUNITY_STALE_DAYS",
    value: "90",
    description: "Records not verified within this many days appear in the verification queue.",
  },
  {
    key: "AI_MONTHLY_TOKENS_FREE",
    value: "100000",
    description:
      "Monthly input plus output plus cache tokens for the free plan. A stored 0 uses this default.",
  },
  {
    key: "AI_MONTHLY_TOKENS_PRO",
    value: "1000000",
    description: "Monthly token allowance for the pro plan. A stored 0 uses this default.",
  },
  {
    key: "AI_MONTHLY_TOKENS_SPONSORED",
    value: "2000000",
    description: "Monthly token allowance for a sponsored plan. A stored 0 uses this default.",
  },
  {
    key: "FREE_PLAN_LIMITS",
    value: "{}",
    description: "Open question: free-tier member and storage limits are not set.",
  },
];

async function main(): Promise<void> {
  for (const funder of funders) {
    await db.funder.upsert({
      where: { slug: funder.slug },
      create: {
        name: funder.name,
        slug: funder.slug,
        type: funder.type as "PRIVATE_FOUNDATION",
        curatorNotes: funder.notes,
        isPublished: false,
        lastVerifiedAt: null,
      },
      update: {},
    });
  }
  for (const setting of settings) {
    await db.platformSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
  console.log(
    `Seeded ${funders.length} unpublished funders and ${settings.length} platform settings.`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    await db.$disconnect();
    process.exit(1);
  });
