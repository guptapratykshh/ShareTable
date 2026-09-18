import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, "../../.env");
dotenv.config({ path: envFile });
dotenv.config();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function csvNums(name: string, fallback: number[]): number[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  return parsed.length ? parsed : fallback;
}

function envStr(name: string) {
  return (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

const SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const;

/** Re-read SMTP keys from `.env` so a running server picks up new mail settings. */
export function reloadSmtpEnv() {
  try {
    const parsed = dotenv.parse(fs.readFileSync(envFile));
    for (const key of SMTP_KEYS) {
      if (parsed[key] != undefined) process.env[key] = parsed[key];
    }
  } catch {
    dotenv.config({ path: envFile });
  }
}

export const config = {
  port: num("PORT", 3001),
  databaseUrl: process.env.DATABASE_URL ?? "mongodb://127.0.0.1:27017/sharetable",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  defaultRadiusKm: num("DEFAULT_RADIUS_KM", 2.5),
  rescueRadiusLevels: csvNums("RESCUE_RADIUS_LEVELS", [2.5, 4, 6]),
  escalationMinutes: csvNums("ESCALATION_MINUTES", [20, 40]),
  get demoMode() {
    return process.env.DEMO_MODE === "true";
  },
  patternMinDonations: num("PATTERN_MIN_DONATIONS", 5),
  awsRegion: process.env.AWS_REGION ?? "ap-south-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  get photoCdnUrl() {
    return envStr("PHOTO_CLOUDFRONT_URL");
  },
  get bedrockModelId() {
    if (this.nodeEnv === "test") return "";
    return process.env.BEDROCK_MODEL_ID ?? "";
  },
  get internalTickSecret() {
    return envStr("INTERNAL_TICK_SECRET");
  },
  get runtime() {
    return envStr("RUNTIME") || "local";
  },
  nodeEnv: process.env.NODE_ENV ?? "development",
  get smtpHost() {
    return envStr("SMTP_HOST");
  },
  get smtpPort() {
    return num("SMTP_PORT", 587);
  },
  get smtpUser() {
    return envStr("SMTP_USER");
  },
  get smtpPass() {
    return envStr("SMTP_PASS").replace(/\s+/g, "");
  },
  get mailFrom() {
    return envStr("MAIL_FROM") || envStr("SMTP_USER") || "ShareTable <noreply@localhost>";
  },
  get smtpConfigured() {
    return Boolean(this.smtpHost && this.smtpUser && this.smtpPass);
  },
};

/** Level 2 / Level 3 age thresholds in ms. Demo mode: 30s / 60s. */
export function escalationThresholdsMs(): [number, number] {
  if (config.demoMode) return [30_000, 60_000];
  const a = (config.escalationMinutes[0] ?? 20) * 60_000;
  const b = (config.escalationMinutes[1] ?? 40) * 60_000;
  return [a, b];
}

export function maxRescueRadiusKm(): number {
  return Math.max(...config.rescueRadiusLevels, config.defaultRadiusKm);
}

export function radiusForLevel(level: number): number {
  const levels = config.rescueRadiusLevels;
  const idx = Math.min(Math.max(level, 1), levels.length) - 1;
  return levels[idx] ?? config.defaultRadiusKm;
}
