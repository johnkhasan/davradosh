import type { ImageDTO } from "@puzzle/shared";
import type { RoomRepository } from "../rooms/repository";
import type { ImageStore } from "./image-store";

export interface GalleryItem {
  provider: "unsplash" | "picsum";
  id: string;
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  sourceUrl: string;
}

export const GALLERY_CATEGORIES = {
  nature: "nature landscape",
  cities: "city architecture",
  animals: "animals",
  art: "colorful art",
  uzbekistan: "uzbekistan samarkand bukhara",
} as const;
export type GalleryCategory = keyof typeof GALLERY_CATEGORIES;

const CACHE_MS = 60 * 60 * 1000;

type Fetch = typeof fetch;

/**
 * Curated images to start a puzzle from. Uses Unsplash (with categories)
 * when an access key is configured, otherwise Lorem Picsum (Unsplash photos,
 * no key needed). Chosen images are imported into our own storage.
 */
export class GalleryService {
  private readonly cache = new Map<string, { at: number; items: GalleryItem[] }>();

  constructor(
    private readonly opts: {
      unsplashKey?: string;
      store: ImageStore;
      repository: RoomRepository;
      fetch?: Fetch;
    },
  ) {}

  get hasCategories(): boolean {
    return Boolean(this.opts.unsplashKey);
  }

  async list(category: GalleryCategory = "nature"): Promise<GalleryItem[]> {
    const key = this.opts.unsplashKey ? `unsplash:${category}` : "picsum";
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.items;
    const items = this.opts.unsplashKey
      ? await this.listUnsplash(category)
      : await this.listPicsum();
    this.cache.set(key, { at: Date.now(), items });
    return items;
  }

  /** Downloads a gallery image once and stores it like an upload. */
  async import(provider: GalleryItem["provider"], sourceId: string): Promise<ImageDTO> {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sourceId)) throw new Error("Invalid gallery id");
    const imageId = `${provider}-${sourceId}`;
    const existing = await this.opts.repository.getImage(imageId);
    if (existing) return existing;

    const { buffer, credit } =
      provider === "unsplash"
        ? await this.downloadUnsplash(sourceId)
        : await this.downloadPicsum(sourceId);
    const stored = await this.opts.store.save(imageId, buffer);
    return this.opts.repository.createImage({ ...stored, source: "unsplash", credit });
  }

  private get fetch(): Fetch {
    return this.opts.fetch ?? fetch;
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await this.fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Gallery request failed: ${res.status}`);
    return (await res.json()) as T;
  }

  private async download(url: string, init?: RequestInit): Promise<Buffer> {
    const res = await this.fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Gallery download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async listPicsum(): Promise<GalleryItem[]> {
    const pages = await Promise.all(
      [2, 5].map((page) =>
        this.json<
          Array<{ id: string; author: string; width: number; height: number; url: string }>
        >(`https://picsum.photos/v2/list?page=${page}&limit=30`),
      ),
    );
    return pages.flat().map((photo) => ({
      provider: "picsum" as const,
      id: photo.id,
      thumbUrl: `https://picsum.photos/id/${photo.id}/480/360`,
      width: photo.width,
      height: photo.height,
      author: photo.author,
      sourceUrl: photo.url,
    }));
  }

  private async downloadPicsum(id: string) {
    const info = await this.json<{ author: string; width: number; height: number }>(
      `https://picsum.photos/id/${id}/info`,
    );
    const scale = Math.min(1, 2048 / Math.max(info.width, info.height));
    const width = Math.round(info.width * scale);
    const height = Math.round(info.height * scale);
    const buffer = await this.download(`https://picsum.photos/id/${id}/${width}/${height}.jpg`);
    return { buffer, credit: `${info.author} / Unsplash` };
  }

  private unsplashHeaders() {
    return { Authorization: `Client-ID ${this.opts.unsplashKey}`, "Accept-Version": "v1" };
  }

  private async listUnsplash(category: GalleryCategory): Promise<GalleryItem[]> {
    const query = encodeURIComponent(GALLERY_CATEGORIES[category]);
    const data = await this.json<{
      results: Array<{
        id: string;
        width: number;
        height: number;
        urls: { small: string };
        user: { name: string };
        links: { html: string };
      }>;
    }>(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=30&orientation=landscape&content_filter=high`,
      {
        headers: this.unsplashHeaders(),
      },
    );
    return data.results.map((photo) => ({
      provider: "unsplash" as const,
      id: photo.id,
      thumbUrl: photo.urls.small,
      width: photo.width,
      height: photo.height,
      author: photo.user.name,
      sourceUrl: photo.links.html,
    }));
  }

  private async downloadUnsplash(id: string) {
    const photo = await this.json<{
      urls: { raw: string };
      user: { name: string };
      links: { download_location: string };
    }>(`https://api.unsplash.com/photos/${id}`, { headers: this.unsplashHeaders() });
    // Unsplash API guidelines: trigger the download endpoint when a photo is used.
    void this.fetch(photo.links.download_location, { headers: this.unsplashHeaders() }).catch(
      () => undefined,
    );
    const buffer = await this.download(`${photo.urls.raw}&w=2048&fm=jpg&q=85`);
    return { buffer, credit: `${photo.user.name} / Unsplash` };
  }
}
