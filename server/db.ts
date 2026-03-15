import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  users,
  profiles,
  wallets,
  notifications,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _schemaInitPromise: Promise<void> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  if (_db && !_schemaInitPromise) {
    _schemaInitPromise = ensureDatabaseSchema(_db);
  }

  if (_schemaInitPromise) {
    await _schemaInitPromise;
  }

  return _db;
}

async function ensureDatabaseSchema(db: ReturnType<typeof drizzle>) {
  await runMigrations(db);
  await ensureLegacyUserColumns(db);
}

async function runMigrations(db: ReturnType<typeof drizzle>) {
  const migrationsFolder = resolveMigrationsFolder();
  if (!migrationsFolder) {
    console.warn("[Database] Migrations folder not found; skipping auto-migration.");
    return;
  }

  try {
    await migrate(db, { migrationsFolder });
  } catch (error) {
    console.warn("[Database] Auto-migration failed:", error);
  }
}

function resolveMigrationsFolder() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "drizzle"),
    path.resolve(cwd, "../drizzle"),
    path.resolve(cwd, "../../drizzle"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function ensureLegacyUserColumns(db: ReturnType<typeof drizzle>) {
  try {
    const result = await db.execute(
      sql`SELECT COLUMN_NAME as columnName
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'users'`
    );

    const existingColumns = new Set(
      (result as Array<{ columnName?: string }>).map(
        (row) => row.columnName?.toLowerCase() ?? ""
      )
    );

    const requiredColumns: Array<{ name: string; definition: string }> = [
      { name: "passwordHash", definition: "VARCHAR(255) NULL" },
      { name: "loginMethod", definition: "VARCHAR(64) NULL" },
      {
        name: "role",
        definition: "ENUM('user','admin') NOT NULL DEFAULT 'user'",
      },
      {
        name: "status",
        definition:
          "ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active'",
      },
      { name: "accountLocked", definition: "TINYINT(1) NOT NULL DEFAULT 0" },
      { name: "deletedAt", definition: "TIMESTAMP NULL DEFAULT NULL" },
      {
        name: "updatedAt",
        definition:
          "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      },
      {
        name: "lastSignedIn",
        definition: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
      },
    ];

    for (const column of requiredColumns) {
      if (!existingColumns.has(column.name.toLowerCase())) {
        await db.execute(
          sql.raw(
            `ALTER TABLE users ADD COLUMN \`${column.name}\` ${column.definition}`
          )
        );
        console.warn(`[Database] Added missing users.${column.name} column`);
      }
    }
  } catch (error) {
    console.warn("[Database] Could not verify legacy users schema:", error);
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });

    // Ensure wallet exists for new users
    const existingUser = await getUserByOpenId(user.openId);
    if (existingUser) {
      await db
        .insert(wallets)
        .values({ userId: existingUser.id, balance: 0 })
        .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return result[0];
}

export async function getWalletByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  return result[0];
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    );
  return result.length;
}
