import { ProductOrigin } from "@feedbacker/contracts";

export interface Config {
  databaseUrl: string;
  allowedOrigins: string[];
  port: number;
}

type Environment = Record<string, string | undefined>;

const parseDatabaseUrl = (value: string | undefined): string => {
  if (!value || !URL.canParse(value) || !["postgres:", "postgresql:"].includes(new URL(value).protocol)) {
    // La valeur n'est jamais affichée : elle peut contenir un mot de passe.
    throw new Error("Invalid configuration: DATABASE_URL must be a PostgreSQL URL");
  }
  return value;
};

const parseAllowedOrigins = (value: string | undefined): string[] => {
  const origins = (value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error("Invalid configuration: ALLOWED_PRODUCT_ORIGINS must list at least one origin");
  }
  for (const origin of origins) {
    if (!ProductOrigin.safeParse(origin).success) {
      throw new Error(
        `Invalid configuration: ALLOWED_PRODUCT_ORIGINS contains "${origin}"; use an exact origin such as https://app.example.com, without wildcard or path`,
      );
    }
  }
  return origins;
};

const parsePort = (value: string | undefined): number => {
  if (value === undefined) return 3000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid configuration: PORT must be an integer between 1 and 65535");
  }
  return port;
};

export const loadConfig = (env: Environment): Config => ({
  databaseUrl: parseDatabaseUrl(env.DATABASE_URL),
  allowedOrigins: parseAllowedOrigins(env.ALLOWED_PRODUCT_ORIGINS),
  port: parsePort(env.PORT),
});
