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

function versionParts(v: string): number[] {
  return v.split(".").map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isNaN(n) ? 0 : n;
  });
}

function compareVersions(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

class TemplateService {
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
        if (!existing || compareVersions(e.version, existing.version) > 0) {
          latestById.set(e.name, e);
        }
      }
      const templates: Template[] = [...latestById.values()].map((e) => ({
        id: e.name,
        version: e.version,
        description: e.description ?? "",
        authors: e.authors ?? [],
        categories: e.categories ?? [],
      }));
      this.#cached = templates;
      this.#fetchedAt = Date.now();
      return templates;
    } catch (error) {
      console.error("Failed to fetch template catalog:", error);
      return this.#cached ?? [];
    }
  }
}

export const templateService = new TemplateService();
