import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../../plugins/authGuard";
import { requireOrg } from "../../plugins/tenancy";
import { NotFoundError } from "../../common/errors";
import {
  createOrg,
  listUserOrgs,
  getOrgById,
  updateOrg,
  deleteOrg,
  isOrgOwner,
  addMemberToOrg,
  listOrgMembers,
  updateMemberRole,
  removeMemberFromOrg,
} from "./service";

type AuthenticatedUser = { userId: string; email?: string };

interface CreateOrgBody {
  name: string;
  slug?: string;
}

interface UpdateOrgBody {
  name?: string;
  slug?: string;
}

interface AddMemberBody {
  email: string;
  roleId: string;
}

interface UpdateMemberRoleBody {
  roleId: string;
}

export default async function orgRoutes(app: FastifyInstance) {
  // Create organization
  app.post(
    "/orgs",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
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

        const org = await createOrg(request.server, user.userId, { name, slug });

        return reply.status(201).send({
          id: org.id,
          name: org.name,
          slug: org.slug,
          ownerId: org.ownerId,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        });
      } catch (error: any) {
        // Handle unique constraint violation (duplicate slug)
        if (error.code === "P2002" && error.meta?.target?.includes("slug")) {
          return reply.status(409).send({ error: "Organization slug already exists" });
        }
        app.log.error(error, "Create organization error");
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // List all organizations for the authenticated user
  app.get(
    "/orgs",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const user = request.user as AuthenticatedUser;
        if (!user.userId) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const orgs = await listUserOrgs(request.server, user.userId);

        return reply.status(200).send(orgs);
      } catch (error) {
        app.log.error(error, "List organizations error");
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Get a specific organization
  app.get(
    "/orgs/:orgId",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { orgId: string };
        const orgId = params.orgId;

        const org = await getOrgById(request.server, orgId);

        if (!org) {
          return reply.status(404).send({ error: "Organization not found" });
        }

        return reply.status(200).send(org);
      } catch (error) {
        app.log.error(error, "Get organization error");
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Update organization
  app.put(
    "/orgs/:orgId",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const user = request.user as AuthenticatedUser;
        if (!user.userId) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const params = request.params as { orgId: string };
        const { orgId } = params;
        const body = request.body as UpdateOrgBody;

        // Check if user is the owner
        const isOwner = await isOrgOwner(request.server, user.userId, orgId);
        if (!isOwner) {
          return reply.status(403).send({ error: "Only the organization owner can update it" });
        }

        // Validate that at least one field is provided
        if (body.name === undefined && body.slug === undefined) {
          return reply.status(400).send({ error: "At least one field (name or slug) must be provided" });
        }

        // Validate name if provided
        if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length === 0)) {
          return reply.status(400).send({ error: "Organization name must be a non-empty string" });
        }

        // Validate slug if provided
        if (body.slug !== undefined && (typeof body.slug !== "string" || body.slug.trim().length === 0)) {
          return reply.status(400).send({ error: "Organization slug must be a non-empty string" });
        }

        const org = await updateOrg(request.server, orgId, body);

        return reply.status(200).send(org);
      } catch (error: any) {
        // Handle unique constraint violation (duplicate slug)
        if (error.code === "P2002" && error.meta?.target?.includes("slug")) {
          return reply.status(409).send({ error: "Organization slug already exists" });
        }
        // Handle not found
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Organization not found" });
        }
        app.log.error(error, "Update organization error");
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Delete organization
  app.delete(
    "/orgs/:orgId",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const user = request.user as AuthenticatedUser;
        if (!user.userId) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const params = request.params as { orgId: string };
        const { orgId } = params;

        // Check if user is the owner
        const isOwner = await isOrgOwner(request.server, user.userId, orgId);
        if (!isOwner) {
          return reply.status(403).send({ error: "Only the organization owner can delete it" });
        }

        // Check if org exists
        const org = await getOrgById(request.server, orgId);
        if (!org) {
          return reply.status(404).send({ error: "Organization not found" });
        }

        await deleteOrg(request.server, orgId);

        return reply.status(200).send({ ok: true });
      } catch (error: any) {
        // Handle not found
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Organization not found" });
        }
        app.log.error(error, "Delete organization error");
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Get current user's membership info for an organization
  app.get(
    "/orgs/:orgId/me",
    { preHandler: [requireAuth, requireOrg] },
    async (req: FastifyRequest) => ({
      orgId: req.org!.orgId,
      roleId: req.org!.roleId,
    })
  );

  // List all members of an organization
  app.get(
    "/orgs/:orgId/members",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { orgId: string };
        const members = await listOrgMembers(request.server, params.orgId);
        return reply.status(200).send(members);
      } catch (error) {
        app.log.error(error, "List members error");
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Add a user to an organization
  app.post(
    "/orgs/:orgId/members",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const user = request.user as AuthenticatedUser;
        const params = request.params as { orgId: string };
        const body = request.body as AddMemberBody;

        // Check if user has permission (owner only)
        const isOwner = await isOrgOwner(request.server, user.userId, params.orgId);
        if (!isOwner) {
          return reply.status(403).send({ error: "Only organization owners can add members" });
        }

        if (!body.email || typeof body.email !== "string") {
          return reply.status(400).send({ error: "Email is required and must be a string" });
        }

        if (!body.roleId || typeof body.roleId !== "string") {
          return reply.status(400).send({ error: "Role ID is required and must be a string" });
        }

        const member = await addMemberToOrg(request.server, params.orgId, body);
        return reply.status(201).send(member);
      } catch (error: any) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message?.includes("already a member")) {
          return reply.status(409).send({ error: error.message });
        }
        app.log.error(error, "Add member error");
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Update a member's role
  app.put(
    "/orgs/:orgId/members/:userId",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const user = request.user as AuthenticatedUser;
        const params = request.params as { orgId: string; userId: string };
        const body = request.body as UpdateMemberRoleBody;

        // Check if user has permission (owner only)
        const isOwner = await isOrgOwner(request.server, user.userId, params.orgId);
        if (!isOwner) {
          return reply.status(403).send({ error: "Only organization owners can update member roles" });
        }

        if (!body.roleId || typeof body.roleId !== "string") {
          return reply.status(400).send({ error: "Role ID is required and must be a string" });
        }

        const member = await updateMemberRole(request.server, params.orgId, params.userId, body.roleId);
        return reply.status(200).send(member);
      } catch (error: any) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message?.includes("already has this role")) {
          return reply.status(409).send({ error: error.message });
        }
        app.log.error(error, "Update member role error");
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Remove a user from an organization
  app.delete(
    "/orgs/:orgId/members/:userId",
    { preHandler: [requireAuth, requireOrg] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Authentication required" });
        }

        const user = request.user as AuthenticatedUser;
        const params = request.params as { orgId: string; userId: string };

        // Check if user has permission (owner only)
        const isOwner = await isOrgOwner(request.server, user.userId, params.orgId);
        if (!isOwner) {
          return reply.status(403).send({ error: "Only organization owners can remove members" });
        }

        // Prevent owner from removing themselves
        if (params.userId === user.userId) {
          return reply.status(400).send({ error: "Cannot remove yourself from the organization" });
        }

        await removeMemberFromOrg(request.server, params.orgId, params.userId);
        return reply.status(200).send({ ok: true });
      } catch (error: any) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        app.log.error(error, "Remove member error");
        reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
}
