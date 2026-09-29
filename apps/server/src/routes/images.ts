import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { GALLERY_CATEGORIES, type GalleryService } from "../images/gallery";
import { InvalidImageError, MAX_UPLOAD_BYTES, type ImageStore } from "../images/image-store";
import { randomId } from "../lib/ids";
import type { RoomRepository } from "../rooms/repository";

const GalleryQuery = z.object({
  category: z.enum(Object.keys(GALLERY_CATEGORIES) as [keyof typeof GALLERY_CATEGORIES]).optional(),
});
const ImportBody = z.object({
  provider: z.enum(["unsplash", "picsum"]),
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

export async function imageRoutes(
  app: FastifyInstance,
  opts: { store: ImageStore; repository: RoomRepository; gallery: GalleryService },
) {
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 1 },
  });

  app.post(
    "/api/uploads",
    { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const file = await request.file().catch(() => undefined);
      if (!file) return reply.code(400).send({ error: "no_file" });
      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch {
        return reply.code(413).send({ error: "too_large" });
      }
      try {
        const stored = await opts.store.save(randomId(12), buffer);
        const image = await opts.repository.createImage({ ...stored, source: "upload" });
        return reply.code(201).send(image);
      } catch (error) {
        if (error instanceof InvalidImageError) {
          return reply.code(415).send({ error: "invalid_image", message: error.message });
        }
        throw error;
      }
    },
  );

  app.get("/api/gallery", async (request, reply) => {
    const query = GalleryQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid" });
    try {
      const items = await opts.gallery.list(query.data.category);
      reply.header("cache-control", "public, max-age=600");
      return {
        categories: opts.gallery.hasCategories ? Object.keys(GALLERY_CATEGORIES) : [],
        items,
      };
    } catch (error) {
      request.log.warn({ err: error }, "gallery unavailable");
      return reply.code(502).send({ error: "gallery_unavailable" });
    }
  });

  app.post(
    "/api/gallery/import",
    { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const body = ImportBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid" });
      try {
        return reply.code(201).send(await opts.gallery.import(body.data.provider, body.data.id));
      } catch (error) {
        request.log.warn({ err: error }, "gallery import failed");
        return reply.code(502).send({ error: "import_failed" });
      }
    },
  );
}
