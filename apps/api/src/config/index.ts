import "dotenv/config";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Treats an empty-string env var the same as an unset one (e.g. `SEED_ADMIN_PASSWORD=` in a .env file). */
function optionalEnv(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-development",
  /** Short-lived; the client silently exchanges a refresh token for a new one on 401. */
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlMs: Number(process.env.REFRESH_TOKEN_TTL_MS ?? 7 * ONE_DAY_MS),
  mongoUri:
    process.env.MONGODB_URI ??
    "mongodb://127.0.0.1:27017/methanova_crm?replicaSet=rs0&directConnection=true",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  /**
   * Optional. If unset, the seed script generates a random dev-only password
   * and prints it once — never hardcode a seed password in source.
   */
  seedAdminEmail: optionalEnv(process.env.SEED_ADMIN_EMAIL),
  seedAdminPassword: optionalEnv(process.env.SEED_ADMIN_PASSWORD),
  /** Counter key and display prefix for lead codes, e.g. LEAD-00001. */
  leadCodePrefix: optionalEnv(process.env.LEAD_CODE_PREFIX) ?? "LEAD",
  /** Days without a first response before the inbox flags a lead as breaching SLA. */
  leadFirstResponseSlaDays: Number(process.env.LEAD_FIRST_RESPONSE_SLA_DAYS ?? 2),
} as const;

if (!config.mongoUri.includes("replicaSet")) {
  throw new Error("MONGODB_URI must include replicaSet so multi-document transactions are available");
}
