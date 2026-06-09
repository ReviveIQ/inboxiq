import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ── DB ────────────────────────────────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;
  const url = process.env.INBOXIQ_DATABASE_URL;
  if (!url) throw new Error("INBOXIQ_DATABASE_URL not set");

  // Use a pool instead of a single connection so TiDB idle timeouts don't
  // kill the connection and cause "Can't add new command when connection is
  // in closed state" errors after periods of inactivity
  const pool = mysql.createPool({
    uri: url,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000, // 30s keepalive ping
  });

  _db = drizzle(pool, { schema, mode: "default" });

  // Run initDb using a single connection from the pool
  const conn = await pool.getConnection();
  try {
    await initDb(conn);
  } finally {
    conn.release();
  }

  return _db;
}

async function initDb(conn: mysql.Connection) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS iq_users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      plan ENUM('free','personal','team','team_plus') DEFAULT 'free',
      planExpiresAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS iq_workspaces (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      ownerId BIGINT NOT NULL,
      plan ENUM('free','personal','team','team_plus') DEFAULT 'free',
      planExpiresAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS iq_workspace_members (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      workspaceId BIGINT NOT NULL,
      userId BIGINT NOT NULL,
      role ENUM('owner','member','viewer') DEFAULT 'member',
      joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ws_user (workspaceId, userId)
    )`,
    `CREATE TABLE IF NOT EXISTS iq_inboxes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      userId BIGINT NOT NULL,
      workspaceId BIGINT,
      provider ENUM('gmail','outlook') NOT NULL,
      email VARCHAR(255) NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      tokenExpiresAt TIMESTAMP NULL,
      lastScanAt TIMESTAMP NULL,
      historyId VARCHAR(255),
      connected TINYINT DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (userId)
    )`,
    `CREATE TABLE IF NOT EXISTS iq_opportunities (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      userId BIGINT NOT NULL,
      workspaceId BIGINT,
      inboxId BIGINT NOT NULL,
      threadId VARCHAR(255) NOT NULL,
      contactName VARCHAR(255),
      contactEmail VARCHAR(255),
      contactCompany VARCHAR(255),
      contactTitle VARCHAR(255),
      subject VARCHAR(500),
      type ENUM('Revenue','Network','Partnership','Reactivation'),
      warmthScore INT,
      opportunityScore INT,
      nextAction VARCHAR(255),
      summary TEXT,
      status ENUM('Active','Waiting','Closed Won','Closed Lost','Dismissed') DEFAULT 'Active',
      lastTouchAt TIMESTAMP NULL,
      snoozedUntil TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NULL,
      INDEX idx_user_status (userId, status),
      INDEX idx_ws_status (workspaceId, status)
    )`,
    `CREATE TABLE IF NOT EXISTS iq_scans (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      inboxId BIGINT NOT NULL,
      userId BIGINT NOT NULL,
      status ENUM('pending','running','complete','failed') DEFAULT 'pending',
      emailsScanned INT DEFAULT 0,
      opportunitiesFound INT DEFAULT 0,
      startedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS iq_invites (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      workspaceId BIGINT NOT NULL,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      usedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of tables) {
    await conn.execute(sql).catch(() => {});
  }
  console.log("[InboxIQ] DB tables ready");
}

// ── Token encryption (AES-256-GCM) ───────────────────────────────────────────
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

export function encryptToken(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ── JWT ───────────────────────────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "inboxiq-dev-secret-change-in-prod");

export async function generateToken(userId: number, email: string): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: number; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as number, email: payload.email as string };
  } catch {
    return null;
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
