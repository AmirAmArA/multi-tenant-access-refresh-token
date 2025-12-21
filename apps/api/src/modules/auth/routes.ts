import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { login, refresh, register, revokeRefreshToken } from "./service";
import { DuplicateEmailError, InvalidCredentialsError, InvalidTokenError } from "../../common/errors";

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
}

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/register",
    async (
      request: FastifyRequest<{ Body: RegisterBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;

        // 1. Check if user already exists
        // 2. Hash password
        // 3. Create user
        // 4. Create access token
        // 5. Create refresh token row (tokenHash + expiry)
        const { accessToken, refreshToken } = await register(
          app,
          email,
          password
        );

        // 6. Set HttpOnly cookie: refresh_token=<raw> (raw only in cookie)
        const isProduction = process.env.NODE_ENV === "production";
        reply.setCookie("refresh_token", refreshToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 7. Return { accessToken }
        reply.status(201).send({ accessToken });
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          reply.status(409).send({ error: error.message });
          return;
        }
        app.log.error(error, "Registration error");
        reply.status(500).send({ 
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  app.post(
    "/auth/login",
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;

        // 1. Find user by email
        // 2. Verify password
        // 3. Create access token
        // 4. Create refresh token row (tokenHash + expiry)
        const { accessToken, refreshToken } = await login(
          app,
          email,
          password
        );

        // 5. Set HttpOnly cookie: refresh_token=<raw> (raw only in cookie)
        const isProduction = process.env.NODE_ENV === "production";
        reply.setCookie("refresh_token", refreshToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 6. Return { accessToken }
        reply.status(200).send({ accessToken });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          reply.status(401).send({ error: error.message });
          return;
        }
        app.log.error(error, "Login error");
        reply.status(500).send({ 
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  app.post(
    "/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // 1. Read cookie refresh_token
        const refreshToken = request.cookies.refresh_token;

        if (!refreshToken) {
          reply.status(401).send({ error: "Refresh token not found" });
          return;
        }

        // 2. Hash it and find session row by hash
        // 3. If not found/revoked/expired → 401
        // 4. Rotate: revoke old token row, create new refresh token row
        // 5. Issue new access token
        const { accessToken, refreshToken: newRefreshToken } = await refresh(
          request.server,
          refreshToken
        );

        // 6. Set new refresh cookie
        const isProduction = process.env.NODE_ENV === "production";
        reply.setCookie("refresh_token", newRefreshToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 7. Return { accessToken }
        reply.status(200).send({ accessToken });
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          reply.status(401).send({ error: error.message });
          return;
        }
        app.log.error(error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  app.post(
    "/auth/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // 1. Read cookie refresh_token
        const refreshToken = request.cookies.refresh_token;

        // 2. Revoke in DB if exists
        if (refreshToken) {
          try {
            await revokeRefreshToken(request.server, refreshToken);
          } catch (error) {
            // Log error but don't fail logout if token doesn't exist
            app.log.warn(error, "Failed to revoke refresh token during logout");
          }
        }

        // 3. Clear cookie
        const isProduction = process.env.NODE_ENV === "production";
        reply.clearCookie("refresh_token", {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
        });

        // 4. Return { ok: true }
        reply.status(200).send({ ok: true });
      } catch (error) {
        app.log.error(error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
