import type { Express, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "../storage";
import { createContext } from "../_core/context";
import { nanoid } from "nanoid";

// Store files in memory (max 10 MB per banner image)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * POST /api/banners/upload
 * Accepts a multipart form with a single "image" field.
 * Returns { url } with the public CDN URL of the uploaded image.
 * Requires admin session.
 */
export function registerBannerUploadRoute(app: Express) {
  app.post(
    "/api/banners/upload",
    upload.single("image"),
    async (req: Request, res: Response) => {
      try {
        // Verify admin session via context
        const ctx = await createContext({ req, res } as any);
        if (!ctx.user || ctx.user.role !== "admin") {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        const ext = req.file.originalname.split(".").pop() ?? "jpg";
        const key = `banners/${nanoid(12)}.${ext}`;
        const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

        res.json({ url, key });
      } catch (err: any) {
        console.error("[Banner Upload] Error:", err.message);
        res.status(500).json({ error: err.message ?? "Upload failed" });
      }
    }
  );
}
