import type { FastifyInstance } from "fastify";
import { NotFoundError } from "../../common/errors";

export interface OrgResponse {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrgData {
  name: string;
  slug?: string;
}

export interface UpdateOrgData {
  name?: string;
  slug?: string;
}

export interface OrgMemberResponse {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
  createdAt: Date;
}

export interface AddMemberData {
  email: string;
  roleId: string;
}

const TEMP_OWNER_ROLE_ID = "TEMP_OWNER_ROLE_ID";

/**
 * Generate a slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a new organization
 */
export async function createOrg(
  fastify: FastifyInstance,
  userId: string,
  data: CreateOrgData
): Promise<OrgResponse> {
  const orgSlug = data.slug || generateSlug(data.name);

  // Create org and membership in a transaction
  const org = await fastify.prisma.$transaction(async (tx) => {
    // Ensure TEMP_OWNER_ROLE_ID exists (required for foreign key)
    await tx.role.upsert({
      where: { id: TEMP_OWNER_ROLE_ID },
      update: {},
      create: {
        id: TEMP_OWNER_ROLE_ID,
        name: "Owner",
      },
    });

    // Create org
    const newOrg = await tx.org.create({
      data: {
        name: data.name,
        slug: orgSlug,
        ownerId: userId,
      },
    });

    // Create membership for creator
    await tx.membership.create({
      data: {
        userId,
        orgId: newOrg.id,
        roleId: TEMP_OWNER_ROLE_ID,
      },
    });

    return newOrg;
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    ownerId: org.ownerId,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * List all organizations a user is a member of
 */
export async function listUserOrgs(
  fastify: FastifyInstance,
  userId: string
): Promise<OrgResponse[]> {
  const memberships = await fastify.prisma.membership.findMany({
    where: {
      userId,
    },
    include: {
      org: true,
    },
  });

  return memberships.map((membership) => ({
    id: membership.org.id,
    name: membership.org.name,
    slug: membership.org.slug,
    ownerId: membership.org.ownerId,
    createdAt: membership.org.createdAt,
    updatedAt: membership.org.updatedAt,
  }));
}

/**
 * Get a specific organization by ID
 */
export async function getOrgById(
  fastify: FastifyInstance,
  orgId: string
): Promise<OrgResponse | null> {
  const org = await fastify.prisma.org.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    return null;
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    ownerId: org.ownerId,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Check if user is the owner of an organization
 */
export async function isOrgOwner(
  fastify: FastifyInstance,
  userId: string,
  orgId: string
): Promise<boolean> {
  const org = await fastify.prisma.org.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });

  return org?.ownerId === userId;
}

/**
 * Update an organization
 */
export async function updateOrg(
  fastify: FastifyInstance,
  orgId: string,
  data: UpdateOrgData
): Promise<OrgResponse> {
  const updateData: { name?: string; slug?: string } = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.slug !== undefined) {
    updateData.slug = data.slug;
  } else if (data.name !== undefined) {
    // If name changed but slug not provided, regenerate slug from new name
    const org = await fastify.prisma.org.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (org) {
      updateData.slug = generateSlug(data.name);
    }
  }

  const org = await fastify.prisma.org.update({
    where: { id: orgId },
    data: updateData,
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    ownerId: org.ownerId,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Delete an organization
 */
export async function deleteOrg(
  fastify: FastifyInstance,
  orgId: string
): Promise<void> {
  // Cascading deletes will handle memberships
  await fastify.prisma.org.delete({
    where: { id: orgId },
  });
}

/**
 * Add a user to an organization
 */
export async function addMemberToOrg(
  fastify: FastifyInstance,
  orgId: string,
  data: AddMemberData
): Promise<OrgMemberResponse> {
  // Find user by email
  const user = await fastify.prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Check if user is already a member with this role
  const existingMembership = await fastify.prisma.membership.findFirst({
    where: {
      userId: user.id,
      orgId,
      roleId: data.roleId,
    },
  });

  if (existingMembership) {
    throw new Error("User is already a member with this role");
  }

  // Verify role exists
  const role = await fastify.prisma.role.findUnique({
    where: { id: data.roleId },
  });

  if (!role) {
    throw new NotFoundError("Role not found");
  }

  // Create membership
  const membership = await fastify.prisma.membership.create({
    data: {
      userId: user.id,
      orgId,
      roleId: data.roleId,
    },
    include: {
      user: true,
      role: true,
    },
  });

  return {
    userId: membership.userId,
    email: membership.user.email,
    roleId: membership.roleId,
    roleName: membership.role.name,
    createdAt: membership.createdAt,
  };
}

/**
 * List all members of an organization
 */
export async function listOrgMembers(
  fastify: FastifyInstance,
  orgId: string
): Promise<OrgMemberResponse[]> {
  const memberships = await fastify.prisma.membership.findMany({
    where: { orgId },
    include: {
      user: true,
      role: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    roleId: m.roleId,
    roleName: m.role.name,
    createdAt: m.createdAt,
  }));
}

/**
 * Update a user's role in an organization
 */
export async function updateMemberRole(
  fastify: FastifyInstance,
  orgId: string,
  userId: string,
  newRoleId: string
): Promise<OrgMemberResponse> {
  // Verify role exists
  const role = await fastify.prisma.role.findUnique({
    where: { id: newRoleId },
  });

  if (!role) {
    throw new NotFoundError("Role not found");
  }

  // Find existing membership
  const existingMembership = await fastify.prisma.membership.findFirst({
    where: {
      userId,
      orgId,
    },
  });

  if (!existingMembership) {
    throw new NotFoundError("Membership not found");
  }

  // If role is the same, return existing membership
  if (existingMembership.roleId === newRoleId) {
    const membership = await fastify.prisma.membership.findFirst({
      where: {
        userId,
        orgId,
        roleId: newRoleId,
      },
      include: {
        user: true,
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundError("Membership not found");
    }

    return {
      userId: membership.userId,
      email: membership.user.email,
      roleId: membership.roleId,
      roleName: membership.role.name,
      createdAt: membership.createdAt,
    };
  }

  // Check if user already has this role
  const existingRoleMembership = await fastify.prisma.membership.findFirst({
    where: {
      userId,
      orgId,
      roleId: newRoleId,
    },
  });

  if (existingRoleMembership) {
    throw new Error("User already has this role");
  }

  // Delete old membership and create new one (since composite key includes roleId)
  const newMembership = await fastify.prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: {
        userId_orgId_roleId: {
          userId: existingMembership.userId,
          orgId: existingMembership.orgId,
          roleId: existingMembership.roleId,
        },
      },
    });

    return await tx.membership.create({
      data: {
        userId,
        orgId,
        roleId: newRoleId,
      },
      include: {
        user: true,
        role: true,
      },
    });
  });

  return {
    userId: newMembership.userId,
    email: newMembership.user.email,
    roleId: newMembership.roleId,
    roleName: newMembership.role.name,
    createdAt: newMembership.createdAt,
  };
}

/**
 * Remove a user from an organization
 */
export async function removeMemberFromOrg(
  fastify: FastifyInstance,
  orgId: string,
  userId: string
): Promise<void> {
  // Find all memberships for this user in this org
  const memberships = await fastify.prisma.membership.findMany({
    where: {
      userId,
      orgId,
    },
  });

  if (memberships.length === 0) {
    throw new NotFoundError("Membership not found");
  }

  // Delete all memberships (user can have multiple roles)
  await fastify.prisma.membership.deleteMany({
    where: {
      userId,
      orgId,
    },
  });
}

