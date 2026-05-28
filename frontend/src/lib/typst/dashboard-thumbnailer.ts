import { TypstCompiler, TypstProject } from "@vedivad/codemirror-typst";

import { api } from "../api";
import { blobUrl } from "../assets/upload";
import { prepareSvgForStorage } from "./prepare-svg";
import { putThumbnail } from "./thumbnail-cache";
import { renderer } from "./use-typst-project";

// One compiler/project for the whole dashboard, created on first use. The
// instance is reused across projects, so jobs are serialized and the VFS is
// cleared between them (the API has no file enumeration — see clear() below).
let enginePromise: Promise<TypstProject> | null = null;

function engine(): Promise<TypstProject> {
  enginePromise ??= (async () => {
    const compiler = await TypstCompiler.create();
    return new TypstProject({ compiler });
  })();
  return enginePromise;
}

let chain: Promise<void> = Promise.resolve();

async function compileThumbnail(projectId: string, version: number | null): Promise<void> {
  const { data } = await api.projects({ id: projectId }).snapshot.get();
  if (!data) return;

  const project = await engine();
  await project.clear();
  await project.setMany(data.files);
  project.entry = data.entry;

  for (const [path, blobId] of Object.entries(data.assets)) {
    const res = await fetch(blobUrl(projectId, blobId), { credentials: "include" });
    if (!res.ok) continue;
    await project.setBinary(path, new Uint8Array(await res.arrayBuffer()));
  }

  const { vector } = await project.compile();
  if (!vector) return;

  const pages = await renderer.renderSvgPages(vector);
  const svg = pages[0]?.svg;
  if (!svg) return;

  await putThumbnail(projectId, await prepareSvgForStorage(svg), version);
}

// Fetch the project's snapshot, compile its first page, and cache the SVG under
// `version`. Jobs run one at a time (the shared compiler is single-tenant);
// failures are swallowed so a bad project just keeps its name fallback.
export function generateThumbnail(projectId: string, version: number | null): Promise<void> {
  const prev = chain;
  const job = (async () => {
    await prev; // previous job always resolves (errors are caught below)
    try {
      await compileThumbnail(projectId, version);
    } catch (error) {
      console.error("[thumbnail] dashboard compile failed", projectId, error);
    }
  })();
  chain = job;
  return job;
}
