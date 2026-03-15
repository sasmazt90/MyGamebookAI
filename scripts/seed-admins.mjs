/**
 * Seed admin users for Gamebook AI.
 * Run once: node scripts/seed-admins.mjs
 *
 * Creates (or updates) the two admin accounts with:
 *   - role = admin
 *   - 1000 credits in wallet
 *   - status = active
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";

// We import the schema directly via the compiled JS path at runtime.
// Since this is an .mjs script we use dynamic import.
const schemaModule = await import("../drizzle/schema.js").catch(() =>
  import("../drizzle/schema.ts")
);
const { users, wallets } = schemaModule;

const ADMINS = [
  {
    email: "tolgar@sasmaz.digital",
    name: "Tolgar",
    password: "Tolgar-1234Tolgar",
  },
  {
    email: "gamebookai@outlook.com",
    name: "GamebookAI Admin",
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

    // Upsert user
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

    // Get the user id
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!row) {
      console.error(`Failed to find user after upsert: ${email}`);
      continue;
    }

    // Upsert wallet with 1000 credits
    await db
      .insert(wallets)
      .values({ userId: row.id, balance: INITIAL_CREDITS })
      .onDuplicateKeyUpdate({ set: { balance: INITIAL_CREDITS } });

    console.log(`✓ Admin seeded: ${email} (userId=${row.id}, credits=${INITIAL_CREDITS})`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
