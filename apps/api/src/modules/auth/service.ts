import type { FastifyInstance } from "fastify";
import { InvalidCredentialsError, InvalidTokenError } from "../../common/errors";
import { generateRefreshToken, hashToken, signAccessToken, verifyPassword } from "./utils";

const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7);

/*

@description Login a user and return access and refresh tokens
whenever  user logs in we check if the email and password are valid
if they are valid we create an access token and a refresh token
the access token is used to access the API
the refresh token is used to refresh the access token
the refresh token is stored in the database
the refresh token is used to refresh the access token

@param fastify Fastify instance
@param email User email
@param password User password
@returns Access and refresh tokens

*/
export async function login(
  fastify: FastifyInstance,
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // Find user by email
  const user = await fastify.prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new InvalidCredentialsError();
  }

  // Create access token
  const accessToken = await signAccessToken(fastify, {
    sub: user.id,
    email: user.email,
  });

  // Generate random refresh token (not JWT)
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  // Store refresh token hash in DB
  await fastify.prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
      // revokedAt is optional, defaults to null (not revoked)
    },
  });

  return {
    accessToken,
    refreshToken, // Return plain token (not hash) to client
  };
}

/*

@description Refresh a refresh token and return a new access token
@param fastify Fastify instance
@param refreshToken Refresh token
@returns Access and refresh tokens

*/
export async function refresh(
  fastify: FastifyInstance,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // Hash the provided token to look it up in DB
  const tokenHash = hashToken(refreshToken);

  // Find refresh token in DB
  const tokenRecord = await fastify.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // Validate token exists
  if (!tokenRecord) {
    throw new InvalidTokenError();
  }

  // Check if token is revoked
  if (tokenRecord.revokedAt) {
    throw new InvalidTokenError("Refresh token has been revoked");
  }

  // Check if token is expired
  if (tokenRecord.expiresAt < new Date()) {
    throw new InvalidTokenError("Refresh token has expired");
  }

  // Rotate refresh token: delete old, create new
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  await fastify.prisma.$transaction([
    // Delete old token
    fastify.prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    }),
    // Create new token
    fastify.prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: tokenRecord.userId,
        expiresAt,
        // revokedAt is optional, defaults to null (not revoked)
      },
    }),
  ]);

  // Create new access token
  const accessToken = await signAccessToken(fastify, {
    sub: tokenRecord.userId,
    email: tokenRecord.user.email,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken, // Return plain token (not hash) to client
  };
}

export async function revokeRefreshToken(
  fastify: FastifyInstance,
  refreshToken: string
): Promise<void> {
  // Hash the provided token to look it up in DB
  const tokenHash = hashToken(refreshToken);

  // Find and revoke the token
  await fastify.prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null, // Only revoke if not already revoked
    },
    data: {
      revokedAt: new Date(),
    },
  });
}