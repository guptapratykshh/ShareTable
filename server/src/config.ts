import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env") });
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
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development",
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
