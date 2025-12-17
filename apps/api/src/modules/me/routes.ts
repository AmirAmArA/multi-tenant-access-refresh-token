import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/authGuard";

/*

@description Get the current user's information
@param app Fastify instance
@returns User information

@param request Fastify request
@param reply Fastify reply
@returns User information

*/
export default async function meRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    { preHandler: requireAuth },
    async (request, reply) => {
      // user is attached by authGuard as request.user
      // returning sub and email as /me payload
      const user = request.user as { sub: string; email: string };
      return {
        id: user.sub,
        email: user.email,
      };
    }
  );
}
