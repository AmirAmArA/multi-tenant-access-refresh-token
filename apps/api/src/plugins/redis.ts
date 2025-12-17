import { FastifyPluginAsync } from "fastify";
import { redis } from "./redis-client";

declare module "fastify" {
  interface FastifyInstance {
    redis: typeof redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default redisPlugin;
