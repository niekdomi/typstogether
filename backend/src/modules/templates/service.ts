import { log } from "../../logger";
import type { Template } from "./model";

interface UniverseEntry {
  name: string;
  version: string;
  description?: string;
  authors?: string[];
  categories?: string[];
  template?: { path: string; entrypoint: string; thumbnail?: string };
}

const CATALOG_URL = "https://packages.typst.org/preview/index.json";
const TTL_MS = 60 * 60 * 1000;

export class TemplateService {
  #cached: Template[] | null = null;
  #fetchedAt = 0;

  async list(): Promise<Template[]> {
    if (this.#cached && Date.now() - this.#fetchedAt < TTL_MS) {
      return this.#cached;
    }
    try {
      const res = await fetch(CATALOG_URL);
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      const entries = (await res.json()) as UniverseEntry[];
      const latestById = new Map<string, UniverseEntry>();
      for (const e of entries) {
        if (e.template === undefined) continue;
        const existing = latestById.get(e.name);
        if (!existing || Bun.semver.order(e.version, existing.version) > 0) {
          latestById.set(e.name, e);
        }
      }
      const templates: Template[] = [...latestById.values()].map((e) => ({
        id: e.name,
        version: e.version,
        description: e.description ?? "",
        authors: e.authors ?? [],
        categories: e.categories ?? [],
        thumbnailUrl: e.template?.thumbnail
          ? `https://packages.typst.org/preview/thumbnails/${e.name}-${e.version}-small.webp`
          : null,
      }));
      this.#cached = templates;
      this.#fetchedAt = Date.now();
      return templates;
    } catch (error) {
      // Non-fatal: serve the stale cache (or empty) so project-create still works.
      log.warn({ err: error }, "Failed to fetch template catalog");
      return this.#cached ?? [];
    }
  }
}

export const templateService = new TemplateService();
