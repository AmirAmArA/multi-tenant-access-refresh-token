import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import prismaPlugin from "./plugins/prisma";
import redisPlugin from "./plugins/redis";
import authRoutes from "./modules/auth/routes";
import meRoutes from "./modules/me/routes";
import orgRoutes from "./modules/org/routes";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cookie);
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret" });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(orgRoutes);

  app.get("/health", async () => ({ ok: true }));

  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
