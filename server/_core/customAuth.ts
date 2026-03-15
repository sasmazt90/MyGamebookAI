/**
 * Custom email/password authentication helper.
 * Replaces Manus OAuth. Uses bcryptjs for password hashing and jose for JWT session cookies.
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ENV } from "./env";
import { COOKIE_NAME } from "../../shared/const";
import { getUserById } from "../db";
import type { Request } from "express";

const BCRYPT_ROUNDS = 12;

// ─── Password helpers ─────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT session helpers ──────────────────────────────────────────────────────

function getSecretKey(): Uint8Array {
  const secret = ENV.cookieSecret;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: number): Promise<string> {
  const secretKey = getSecretKey();
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<number | null> {
  if (!token) return null;
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    const userId = parseInt(String(payload.sub), 10);
    return isNaN(userId) ? null : userId;
  } catch {
    return null;
  }
}

// ─── Request authentication ───────────────────────────────────────────────────

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) map.set(k.trim(), decodeURIComponent(v.join("=").trim()));
  }
  return map;
}

export async function authenticateRequest(req: Request) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get(COOKIE_NAME);
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user) return null;
  if (user.status === "deleted") return null;
  return user;
}
