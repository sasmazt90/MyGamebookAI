/**
 * Seed admin users for Gamebook AI.
 * Run: npx tsx scripts/seed-admins.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users, wallets, profiles } from "../drizzle/schema";

const ADMINS = [
  {
    email: "tolgar@sasmaz.digital",
    name: "Tolgar",
    authorName: "TolgarSasmaz",
    password: "Tolgar-1234Tolgar",
  },
  {
    email: "gamebookai@outlook.com",
    name: "GamebookAI Admin",
    authorName: "GamebookAI",
    password: "Tolgar-1234Tolgar",
  },
];

const INITIAL_CREDITS = 1000;
const BCRYPT_ROUNDS = 12;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const db = drizzle(databaseUrl);

  for (const admin of ADMINS) {
    const email = admin.email.toLowerCase().trim();
    const openId = `email:${email}`;
    const passwordHash = await bcrypt.hash(admin.password, BCRYPT_ROUNDS);

    await db
      .insert(users)
      .values({
        openId,
        name: admin.name,
        email,
        passwordHash,
        loginMethod: "email",
        role: "admin",
        status: "active",
        accountLocked: false,
        lastSignedIn: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          role: "admin",
          status: "active",
          accountLocked: false,
          passwordHash,
          name: admin.name,
        },
      });

    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!row) {
      console.error(`Failed to find user after upsert: ${email}`);
      continue;
    }

    await db
      .insert(wallets)
      .values({ userId: row.id, balance: INITIAL_CREDITS })
      .onDuplicateKeyUpdate({ set: { balance: INITIAL_CREDITS } });

    // Create profile (author name)
    const authorNameLower = admin.authorName.toLowerCase();
    await db
      .insert(profiles)
      .values({
        userId: row.id,
        authorName: admin.authorName,
        authorNameLower,
        onboardingComplete: true,
        interfaceLanguage: "en",
      })
      .onDuplicateKeyUpdate({
        set: {
          authorName: admin.authorName,
          authorNameLower,
          onboardingComplete: true,
        },
      });

    console.log(`✓ Admin seeded: ${email} (userId=${row.id}, credits=${INITIAL_CREDITS}, authorName=${admin.authorName})`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
