import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  unique,
} from "drizzle-orm/mysql-core";

// ─── Users (Email/Password Auth) ────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "suspended", "deleted"]).default("active").notNull(),
  accountLocked: boolean("accountLocked").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Profiles ─────────────────────────────────────────────────────────────────

export const profiles = mysqlTable("profiles", {
  userId: int("userId").primaryKey().references(() => users.id),
  authorName: varchar("authorName", { length: 30 }).notNull(),
  authorNameLower: varchar("authorNameLower", { length: 30 }).notNull().unique(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  interfaceLanguage: varchar("interfaceLanguage", { length: 10 }).default("en").notNull(),
  onboardingComplete: boolean("onboardingComplete").default(false).notNull(),
  // Cached author stats (write-through on purchase / review / completion)
  cachedTotalBooks: int("cachedTotalBooks").default(0).notNull(),
  cachedTotalSales: int("cachedTotalSales").default(0).notNull(),
  cachedTotalReviews: int("cachedTotalReviews").default(0).notNull(),
  cachedAverageRating: float("cachedAverageRating").default(0).notNull(),
  cachedTotalCompletions: int("cachedTotalCompletions").default(0).notNull(),
  statsUpdatedAt: timestamp("statsUpdatedAt").defaultNow().notNull(),
  // Leaderboard rank snapshots (updated when leaderboard is queried)
  lastBestSellerRank: int("lastBestSellerRank"),
  lastNewArrivalRank: int("lastNewArrivalRank"),
  lastMostPopularRank: int("lastMostPopularRank"),
  lastRankSnapshotAt: timestamp("lastRankSnapshotAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;

// ─── Credits & Transactions ───────────────────────────────────────────────────

export const wallets = mysqlTable("wallets", {
  userId: int("userId").primaryKey().references(() => users.id),
  balance: int("balance").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;

export const creditTransactions = mysqlTable("creditTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  type: mysqlEnum("type", [
    "purchase",
    "spend_generate",
    "spend_buy",
    "earn_sale",
    "admin_adjust",
    "monthly_reward",
    "refund_reversal",
  ]).notNull(),
  amount: int("amount").notNull(),
  balanceAfter: int("balanceAfter").notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;

// ─── Books ────────────────────────────────────────────────────────────────────

export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "fairy_tale",
    "comic",
    "crime_mystery",
    "fantasy_scifi",
    "romance",
    "horror_thriller",
  ]).notNull(),
  bookLanguage: varchar("bookLanguage", { length: 10 }).default("en").notNull(),
  length: mysqlEnum("length", ["thin", "normal", "thick"]).notNull(),
  description: text("description"),
  coverImageUrl: text("coverImageUrl"),
  status: mysqlEnum("status", ["generating", "ready", "failed", "deleted"]).default("generating").notNull(),
  generationJobId: varchar("generationJobId", { length: 255 }),
  totalPages: int("totalPages").default(0),
  totalBranches: int("totalBranches").default(0),
  isPublished: boolean("isPublished").default(false).notNull(),
  isDelisted: boolean("isDelisted").default(false).notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  featuredOrder: int("featuredOrder").default(0).notNull(),
  characterCards: json("characterCards"), // Array of { name, appearance, voice, role, visualAnchor }
  portraitUrls: json("portraitUrls"), // Array of { characterName: string; url: string } for generated style-bridge illustrations
  generationStep: varchar("generationStep", { length: 255 }), // e.g. "Expanding page 12 of 30…"
  illustrationStyleLock: text("illustrationStyleLock"), // Assembled style lock string used for all image prompts
  visualBlueprint: json("visualBlueprint"), // Canonical continuity state: characters, objects, style, readable-path metadata
  storePrice: int("storePrice"),
  purchaseCount: int("purchaseCount").default(0).notNull(),
  reviewCount: int("reviewCount").default(0).notNull(),
  averageRating: float("averageRating").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

export const bookCharacters = mysqlTable("bookCharacters", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull().references(() => books.id),
  name: varchar("name", { length: 100 }).notNull(),
  photoUrl: text("photoUrl"),
  orderIndex: int("orderIndex").default(0).notNull(),
});

export type BookCharacter = typeof bookCharacters.$inferSelect;

export const bookPages = mysqlTable("bookPages", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull().references(() => books.id),
  pageNumber: int("pageNumber").notNull(),
  branchPath: varchar("branchPath", { length: 255 }).default("root").notNull(),
  isBranchPage: boolean("isBranchPage").default(false).notNull(),
  content: text("content"),
  imageUrl: text("imageUrl"),
  panels: json("panels"),
  choiceA: text("choiceA"),
  choiceB: text("choiceB"),
  nextPageIdA: int("nextPageIdA"),
  nextPageIdB: int("nextPageIdB"),
  sfxTags: json("sfxTags"),
  sceneSpec: json("sceneSpec"), // Structured scene plan used to keep illustrations aligned with narrative continuity
  format: mysqlEnum("format", ["landscape", "portrait"]).default("portrait").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookPage = typeof bookPages.$inferSelect;

// ─── Reading Progress ─────────────────────────────────────────────────────────

export const readingProgress = mysqlTable("readingProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  bookId: int("bookId").notNull().references(() => books.id),
  currentPageId: int("currentPageId"),
  branchPath: varchar("branchPath", { length: 255 }).default("root").notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── User Book Ownership ──────────────────────────────────────────────────────

export const userBooks = mysqlTable("userBooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  bookId: int("bookId").notNull().references(() => books.id),
  acquiredVia: mysqlEnum("acquiredVia", ["generated", "purchased"]).notNull(),
  pricePaid: int("pricePaid").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserBook = typeof userBooks.$inferSelect;

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull().references(() => books.id),
  userId: int("userId").notNull().references(() => users.id),
  rating: int("rating").notNull(),
  reviewText: text("reviewText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  linkUrl: varchar("linkUrl", { length: 500 }),
  metadataJson: json("metadataJson"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Banners ──────────────────────────────────────────────────────────────────

export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  imageUrl: text("imageUrl").notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  ctaLink: varchar("ctaLink", { length: 500 }).default("/create").notNull(),
  translations: json("translations").notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  discountType: mysqlEnum("discountType", ["percent", "fixed"]).notNull(),
  discountValue: float("discountValue").notNull(),
  targetCategories: json("targetCategories").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;

// ─── Monthly Rewards ──────────────────────────────────────────────────────────

export const monthlyRewards = mysqlTable(
  "monthlyRewards",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
    creditsAwarded: int("creditsAwarded").default(10).notNull(),
    rank: int("rank").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniqUserMonth: unique("monthlyRewards_userId_yearMonth_uq").on(t.userId, t.yearMonth),
  })
);

// ─── Generation Jobs (queue) ──────────────────────────────────────────────────────────

export const generationJobs = mysqlTable("generationJobs", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull().references(() => books.id),
  status: mysqlEnum("status", ["queued", "generating", "completed", "failed"]).default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  // Lease-based locking fields (prevent double-processing)
  lockedAt: timestamp("lockedAt"),
  lockedBy: varchar("lockedBy", { length: 128 }),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  attempts: int("attempts").default(0).notNull(),
});
export type GenerationJob = typeof generationJobs.$inferSelect;

// ─── Stripe Events (idempotency) ────────────────────────────────────────────

export const stripeEvents = mysqlTable("stripeEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});
export type StripeEvent = typeof stripeEvents.$inferSelect;

// ─── Book Reports (moderation) ────────────────────────────────────────────────

export const bookReports = mysqlTable("bookReports", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull().references(() => books.id),
  reporterUserId: int("reporterUserId").notNull().references(() => users.id),
  reason: varchar("reason", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "resolved"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BookReport = typeof bookReports.$inferSelect;

// ─── Audio Settings ───────────────────────────────────────────────────────────

export const audioSettings = mysqlTable("audioSettings", {
  userId: int("userId").primaryKey().references(() => users.id),
  isMuted: boolean("isMuted").default(false).notNull(),
  volume: float("volume").default(0.7).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Notification Throttle (anti-spam) ────────────────────────────────────────

export const notificationThrottle = mysqlTable("notificationThrottle", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  notificationType: varchar("notificationType", { length: 64 }).notNull(),
  referenceKey: varchar("referenceKey", { length: 255 }).notNull(), // e.g. bookId, milestoneLevel
  lastSentAt: timestamp("lastSentAt").defaultNow().notNull(),
});
export type NotificationThrottle = typeof notificationThrottle.$inferSelect;
