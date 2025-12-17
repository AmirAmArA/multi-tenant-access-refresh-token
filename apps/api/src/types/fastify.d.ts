import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: { userId: string; email?: string };
    org?: { orgId: string; roleId: string };
  }
}
