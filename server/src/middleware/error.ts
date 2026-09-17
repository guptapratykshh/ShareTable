import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const mongo = err as { code?: number; name?: string };
  if (mongo?.code === 11000) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  console.error(err);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found." });
}
