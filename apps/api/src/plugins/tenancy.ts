import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthenticationError } from "../common/errors";

type AuthenticatedUser = { userId: string; email?: string };

/**
 * Require organization membership
 * 
 * Must run after requireAuth (needs request.user.userId)
 * 
 * - Extracts orgId from URL params
 * - Checks membership exists for (userId, orgId)
 * - Sets request.org = { orgId, roleId }
 * - Rejects with 401 if membership not found or authentication required
 */

export async function requireOrg(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Ensure user is authenticated (must run after requireAuth)
    if (!request.user) {
      throw new AuthenticationError("Authentication required");
    }
    
    const user = request.user as AuthenticatedUser;
    if (!user.userId) {
      throw new AuthenticationError("Authentication required");
    }

    const userId = user.userId;

    // Extract orgId from URL params
    const params = request.params as Record<string, string>;
    const orgId = params.orgId || params["orgId"];

    if (!orgId || typeof orgId !== "string") {
      throw new AuthenticationError("Missing or invalid organization ID");
    }

    // Check membership exists for (userId, orgId)
    const membership = await request.server.prisma.membership.findFirst({
      where: {
        userId,
        orgId,
      },
      select: {
        roleId: true,
      },
    });

    if (!membership) {
      throw new AuthenticationError("Organization membership not found");
    }

    // Set request.org with orgId and roleId
    request.org = {
      orgId: orgId,
      roleId: membership.roleId,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      reply.status(403).send({ error: error.message });
      return;
    }
    // Unexpected errors
    reply.status(401).send({ error: "Unauthorized" });
  }
}