import type { FastifyInstance } from "fastify";

export const contentSecurityPolicy = (allowedOrigins: string[]): string =>
  [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    // Le navigateur applique lui aussi la liste de sites, y compris aux navigations dans l'iframe (R8).
    `frame-src ${allowedOrigins.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

export const registerSecurityHeaders = (app: FastifyInstance, allowedOrigins: string[]): void => {
  const csp = contentSecurityPolicy(allowedOrigins);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    const contentType = reply.getHeader("content-type");
    if (typeof contentType === "string" && contentType.includes("text/html")) {
      reply.header("Content-Security-Policy", csp);
    }
  });
};
