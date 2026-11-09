import fastifyStatic from "@fastify/static";
import type { ApiError } from "@feedbacker/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { registerFeedbackRoutes } from "./feedback/routes.ts";
import { registerSecurityHeaders } from "./securityHeaders.ts";

export const BODY_LIMIT_BYTES = 64 * 1024;

export interface AppOptions {
  pool: pg.Pool;
  allowedOrigins: string[];
  now: () => Date;
  staticRoot: string;
  logger?: boolean;
}

export const apiError = (code: ApiError["code"], issues?: ApiError["issues"]): ApiError =>
  issues ? { code, issues } : { code };

const isFastifyErrorWithStatus = (error: unknown): error is { statusCode: number } =>
  typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number";

export const buildApp = (options: AppOptions): FastifyInstance => {
  const app = Fastify({
    bodyLimit: BODY_LIMIT_BYTES,
    // Les journaux par défaut de Fastify ne contiennent ni corps de requête ni texte de retour (R13).
    logger: options.logger ?? true,
  });

  app.setErrorHandler((error, request, reply) => {
    if (isFastifyErrorWithStatus(error) && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send(apiError("VALIDATION_ERROR"));
    }
    request.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "unexpected error");
    return reply.status(500).send(apiError("INTERNAL_ERROR"));
  });

  // Perte d'une connexion inactive (redémarrage de la base) : le pool se rétablit de lui-même.
  options.pool.on("error", (error) => {
    app.log.error({ errorName: error.name }, "idle database connection lost");
  });

  registerSecurityHeaders(app, options.allowedOrigins);
  registerFeedbackRoutes(app, options);
  void app.register(fastifyStatic, {
    root: options.staticRoot,
    cacheControl: false,
    setHeaders: (reply, path) => {
      if (path.endsWith("connector.js")) void reply.header("Cache-Control", "public, max-age=300");
    },
  });

  return app;
};
