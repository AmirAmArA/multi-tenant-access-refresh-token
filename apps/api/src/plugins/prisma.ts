import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "./db";

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

//Fastify plugin encapsulation prevented authRoutes from accessing the prisma decorator.
//By using fastify-plugin, we ensure that the prisma decorator is available to all routes.
export default fp(prismaPlugin);
