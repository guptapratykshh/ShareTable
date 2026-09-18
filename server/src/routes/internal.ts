import { Router } from "express";
import { config } from "../config.js";
import { escalateClaimableDonations } from "../services/escalation.js";
import { expireStaleDonations } from "../services/expiration.js";
import { AppError } from "../utils.js";

export const internalRouter = Router();

internalRouter.post("/rescue-tick", async (req, res, next) => {
  try {
    const secret = req.header("x-internal-secret") ?? "";
    if (!config.internalTickSecret || secret !== config.internalTickSecret) {
      throw new AppError("Unauthorized.", 401);
    }

    const expired = await expireStaleDonations();
    await escalateClaimableDonations();
    const payload = {
      ok: true,
      expired,
      at: new Date().toISOString(),
    };
    console.log(JSON.stringify({ event: "rescue-tick", ...payload }));
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
