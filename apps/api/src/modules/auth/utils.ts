import crypto from "crypto";
import bcrypt from "bcrypt";
import type { JwtAccessPayload } from "./types";
import { FastifyInstance } from "fastify";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function signAccessToken(
  app: FastifyInstance,
  payload: JwtAccessPayload
) {
  const ttlMin = Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15);
  return app.jwt.sign(
    { email: payload.email },
    { sub: payload.sub, expiresIn: `${ttlMin}m` }
  );
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  // fast hash (not bcrypt) is fine for tokens; use sha256
  return crypto.createHash("sha256").update(token).digest("hex");
}
