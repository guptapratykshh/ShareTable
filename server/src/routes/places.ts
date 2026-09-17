import { Router } from "express";

export const placesRouter = Router();

const PHOTON = "https://photon.komoot.io";
const UA = "ShareTable/1.0 (https://github.com/the-ivii/ShareTable)";

async function photon(path: string) {
  const res = await fetch(`${PHOTON}${path}`, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) {
    const err = new Error("Place search failed.") as Error & { statusCode?: number };
    err.statusCode = 502;
    throw err;
  }
  return res.json();
}

placesRouter.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 3) {
      res.json({ features: [] });
      return;
    }
    const params = new URLSearchParams({ q, limit: "8" });
    const lat = String(req.query.lat ?? "");
    const lon = String(req.query.lon ?? req.query.lng ?? "");
    if (lat && lon) {
      params.set("lat", lat);
      params.set("lon", lon);
    }
    res.json(await photon(`/api/?${params}`));
  } catch (err) {
    next(err);
  }
});

placesRouter.get("/reverse", async (req, res, next) => {
  try {
    const lat = String(req.query.lat ?? "");
    const lon = String(req.query.lon ?? req.query.lng ?? "");
    if (!lat || !lon) {
      res.json({ features: [] });
      return;
    }
    const params = new URLSearchParams({ lat, lon });
    res.json(await photon(`/reverse?${params}`));
  } catch (err) {
    next(err);
  }
});
