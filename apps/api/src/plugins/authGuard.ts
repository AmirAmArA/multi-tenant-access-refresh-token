import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtAccessPayload } from "../modules/auth/types";
import { AuthenticationError } from "../common/errors";



export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token
    const decoded = await request.server.jwt.verify<JwtAccessPayload>(token);

    // Attach user info to request
    request.user = decoded;

    // Continue to next handler
  } catch (error) {
    if (error instanceof AuthenticationError) {
      reply.status(401).send({ error: error.message });
      return;
    }
    // JWT verification errors
    reply.status(401).send({ error: "Invalid or expired token" });
  }
}
