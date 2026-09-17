import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { donationsRouter } from "./routes/donations.js";
import { claimsRouter } from "./routes/claims.js";
import { notificationsRouter } from "./routes/notifications.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { adminRouter } from "./routes/admin.js";
import { aiRouter } from "./routes/ai.js";
import { assistantRouter } from "./routes/assistant.js";
import { donorRouter } from "./routes/donor.js";
import { recipientsRouter } from "./routes/recipients.js";
import { placesRouter } from "./routes/places.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { publicImpact } from "./services/dashboard.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: config.clientOrigin.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  if (config.nodeEnv !== "test") {
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 120,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "sharetable", demoMode: config.demoMode });
  });

  app.get("/api/impact", async (_req, res, next) => {
    try {
      res.json(await publicImpact());
    } catch (err) {
      next(err);
    }
  });

  app.use("/api/places", placesRouter);

  app.use("/api/auth", authRouter);
  app.use("/api/donations", donationsRouter);
  app.use("/api/claims", claimsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/donor", donorRouter);
  app.use("/api/recipients", recipientsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/assistant", assistantRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
