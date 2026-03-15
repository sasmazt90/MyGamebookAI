import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users, wallets } from "../drizzle/schema";

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  const admins = await db.select({
    id: users.id, email: users.email, role: users.role, name: users.name
  }).from(users).where(eq(users.role, "admin"));
  console.log("Admins:", JSON.stringify(admins, null, 2));
  for (const admin of admins) {
    const wallet = await db.select().from(wallets).where(eq(wallets.userId, admin.id));
    console.log(`Wallet for ${admin.email}:`, wallet[0]?.balance ?? "NOT FOUND");
  }
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
