import { CreateFeedbackRequest, ListFeedbackQuery, type ListFeedbackResponse } from "@feedbacker/contracts";
import type { FastifyInstance } from "fastify";
import { apiError, type AppOptions } from "../app.ts";
import { insertFeedback, listFeedbackByOrigin } from "./queries.ts";

export const registerFeedbackRoutes = (app: FastifyInstance, options: AppOptions): void => {
  app.get("/api/feedback", async (request, reply) => {
    const query = ListFeedbackQuery.safeParse(request.query);
    if (!query.success) return reply.status(400).send(apiError("VALIDATION_ERROR"));
    if (!options.allowedOrigins.includes(query.data.origin)) {
      return reply.status(403).send(apiError("ORIGIN_NOT_ALLOWED"));
    }
    const response: ListFeedbackResponse = { items: await listFeedbackByOrigin(options.pool, query.data.origin) };
    return response;
  });

  app.post("/api/feedback", async (request, reply) => {
    const body = CreateFeedbackRequest.safeParse(request.body);
    if (!body.success) {
      const issues = body.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code }));
      return reply.status(400).send(apiError("VALIDATION_ERROR", issues));
    }
    if (!options.allowedOrigins.includes(body.data.productOrigin)) {
      return reply.status(403).send(apiError("ORIGIN_NOT_ALLOWED"));
    }
    const { feedback, created } = await insertFeedback(options.pool, body.data, options.now());
    return reply.status(created ? 201 : 200).send(feedback);
  });
};
