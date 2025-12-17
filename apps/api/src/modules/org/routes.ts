import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../../plugins/authGuard";
import { requireOrg } from "../../plugins/tenancy";

type AuthenticatedUser = { userId: string; email?: string };

interface CreateOrgBody {
  name: string;
  slug?: string;
}

const TEMP_OWNER_ROLE_ID = "TEMP_OWNER_ROLE_ID";

export default async function orgRoutes(app: FastifyInstance) {
  app.post(
    "/orgs",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Ensure user is authenticated
      if (!request.user) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const user = request.user as AuthenticatedUser;
      if (!user.userId) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const body = request.body as CreateOrgBody;
      const { name, slug } = body;

      if (!name || typeof name !== "string") {
        return reply.status(400).send({ error: "Organization name is required" });
      }

      // Generate slug from name if not provided
      const orgSlug =
        slug ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      try {
        // Create org and membership in a transaction
        const result = await request.server.prisma.$transaction(async (tx) => {
          // 0. Ensure TEMP_OWNER_ROLE_ID exists (required for foreign key)
          await tx.role.upsert({
            where: { id: TEMP_OWNER_ROLE_ID },
            update: {},
            create: {
              id: TEMP_OWNER_ROLE_ID,
              name: "Owner",
            },
          });

          // 1. Create org
          const org = await tx.org.create({
            data: {
              name,
              slug: orgSlug,
              ownerId: user.userId,
            },
          });

          // 2. Create membership for creator
          await tx.membership.create({
            data: {
              userId: user.userId,
              orgId: org.id,
              roleId: TEMP_OWNER_ROLE_ID,
            },
          });

          return org;
        });

        return reply.status(201).send({
          id: result.id,
          name: result.name,
          slug: result.slug,
        });
      } catch (error: any) {
        // Handle unique constraint violation (duplicate slug)
        if (error.code === "P2002" && error.meta?.target?.includes("slug")) {
          return reply.status(409).send({ error: "Organization slug already exists" });
        }
        throw error;
      }
    }
  );

  app.get(
    "/orgs/:orgId/me",
    { preHandler: [requireAuth, requireOrg] },
    async (req: FastifyRequest) => ({
      orgId: req.org!.orgId,
      roleId: req.org!.roleId,
    })
  );
}
