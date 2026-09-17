import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { AppError } from "../utils.js";

const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = MIME[file.mimetype] ?? ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1.5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!MIME[file.mimetype]) {
      cb(new AppError("Use a JPEG, PNG, or WebP photo."));
      return;
    }
    cb(null, true);
  },
});

export const uploadsDir = uploadDir;
export const uploadsRouter = Router();

uploadsRouter.post("/photo", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      next(new AppError(err.code === "LIMIT_FILE_SIZE" ? "Photo is too large. Use a smaller image." : err.message));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    if (!req.file) {
      next(new AppError("Choose a photo to upload."));
      return;
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});
