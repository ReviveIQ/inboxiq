import { mysqlTable, bigint, varchar, text, timestamp, mysqlEnum, tinyint, int, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("iq_users", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "personal", "team", "team_plus"]).default("free"),
  planExpiresAt: timestamp("planExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const workspaces = mysqlTable("iq_workspaces", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: bigint("ownerId", { mode: "number" }).notNull(),
  plan: mysqlEnum("plan", ["free", "personal", "team", "team_plus"]).default("free"),
  planExpiresAt: timestamp("planExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const workspaceMembers = mysqlTable("iq_workspace_members", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  workspaceId: bigint("workspaceId", { mode: "number" }).notNull(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  role: mysqlEnum("role", ["owner", "member", "viewer"]).default("member"),
  joinedAt: timestamp("joinedAt").defaultNow(),
});

export const inboxes = mysqlTable("iq_inboxes", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  workspaceId: bigint("workspaceId", { mode: "number" }),
  provider: mysqlEnum("provider", ["gmail", "outlook"]).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  accessToken: text("accessToken"),   // AES-256 encrypted
  refreshToken: text("refreshToken"), // AES-256 encrypted
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  lastScanAt: timestamp("lastScanAt"),
  historyId: varchar("historyId", { length: 255 }),
  connected: tinyint("connected").default(1),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const opportunities = mysqlTable("iq_opportunities", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  workspaceId: bigint("workspaceId", { mode: "number" }),
  inboxId: bigint("inboxId", { mode: "number" }).notNull(),
  threadId: varchar("threadId", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 255 }),
  contactCompany: varchar("contactCompany", { length: 255 }),
  contactTitle: varchar("contactTitle", { length: 255 }),
  subject: varchar("subject", { length: 500 }),
  type: mysqlEnum("type", ["Revenue", "Network", "Partnership", "Reactivation"]),
  warmthScore: int("warmthScore"),
  opportunityScore: int("opportunityScore"),
  nextAction: varchar("nextAction", { length: 255 }),
  summary: text("summary"),
  status: mysqlEnum("status", ["Active", "Waiting", "Closed Won", "Closed Lost", "Dismissed"]).default("Active"),
  lastTouchAt: timestamp("lastTouchAt"),
  snoozedUntil: timestamp("snoozedUntil"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt"),
});

export const scans = mysqlTable("iq_scans", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  inboxId: bigint("inboxId", { mode: "number" }).notNull(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).default("pending"),
  emailsScanned: int("emailsScanned").default(0),
  opportunitiesFound: int("opportunitiesFound").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const invites = mysqlTable("iq_invites", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  workspaceId: bigint("workspaceId", { mode: "number" }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});
