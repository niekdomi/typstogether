import { TypstCompiler, TypstProject } from "@vedivad/codemirror-typst";

import { api } from "../api";
import { blobUrl } from "../assets/upload";
import { storeThumbnail } from "./thumbnail-cache";
import { renderer } from "./use-typst-project";

// One compiler/project for the whole dashboard, created on first use. The
// instance is reused across projects, so jobs are serialized and the VFS is
// cleared between them (the API has no file enumeration - see clear() below).
let enginePromise: Promise<TypstProject> | null = null;

function engine(): Promise<TypstProject> {
  enginePromise ??= (async () => {
    try {
      const compiler = await TypstCompiler.create();
      return new TypstProject({ compiler });
    } catch (error) {
      // Don't cache a failed compiler init; reset so the next card retries.
      enginePromise = null;
      throw error;
    }
  })();
  return enginePromise;
}

let chain: Promise<void> = Promise.resolve();

async function compileThumbnail(projectId: string): Promise<void> {
  const { data } = await api.projects({ id: projectId }).snapshot.get();
  if (!data) return;

  // Fetch every asset in parallel before touching the shared engine, so an
  // image-heavy project doesn't stall the serialized thumbnail queue on N
  // back-to-back round-trips.
  const assetPairs = await Promise.all(
    Object.entries(data.assets).map(async ([path, blobId]) => {
      const res = await fetch(blobUrl(projectId, blobId), { credentials: "include" });
      if (!res.ok) return null;
      return [path, new Uint8Array(await res.arrayBuffer())] as const;
    })
  );
  const binaries: Record<string, Uint8Array> = {};
  for (const pair of assetPairs) {
    if (pair) binaries[pair[0]] = pair[1];
  }

  const project = await engine();
  await project.clear();
  await project.setMany({ ...data.files, ...binaries });
  project.entry = data.entry;

  const { vector } = await project.compile();
  if (!vector) return;

  const pages = await renderer.renderSvgPages(vector);
  const svg = pages[0]?.svg;
  if (!svg) return;

  await storeThumbnail(projectId, svg);
}

// Fetch the project's snapshot and compile its first page into the cache. Used
// as the cold-start fallback when a project has no cached thumbnail yet. Jobs
// run one at a time (the shared compiler is single-tenant); failures are
// swallowed so a bad project just keeps its name fallback.
export function generateThumbnail(projectId: string): Promise<void> {
  const prev = chain;
  const job = (async () => {
    await prev; // previous job always resolves (errors are caught below)
    try {
      await compileThumbnail(projectId);
    } catch (error) {
      console.error("[thumbnail] dashboard compile failed", projectId, error);
    }
  })();
  chain = job;
  return job;
}
