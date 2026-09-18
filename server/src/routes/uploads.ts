import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { AppError } from "../utils.js";

const MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const bodySchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

function publicPhotoUrl(key: string) {
  if (config.photoCdnUrl) return `${config.photoCdnUrl.replace(/\/$/, "")}/${key}`;
  return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;
}

export const uploadsRouter = Router();

uploadsRouter.post("/photo-url", requireAuth, async (req, res, next) => {
  try {
    if (!config.s3Bucket) throw new AppError("Photo storage is not configured.", 503);
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Use a JPEG, PNG, or WebP photo.");

    const ext = MIME[parsed.data.contentType];
    const key = `photos/${randomUUID()}${ext}`;
    const client = new S3Client({ region: config.awsRegion });
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        ContentType: parsed.data.contentType,
      }),
      { expiresIn: 300 },
    );

    res.json({ uploadUrl, publicUrl: publicPhotoUrl(key), key });
  } catch (err) {
    next(err);
  }
});
