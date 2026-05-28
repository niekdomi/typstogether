// Dashboard thumbnails live only in the client: each project's first compile
// produces a self-contained SVG that we gzip and stash in IndexedDB, keyed by
// projectId. There is no server copy, so a project shows a preview only on
// devices where it has been opened.

const DB_NAME = "typstogether";
const STORE = "thumbnails";
const MAX_ENTRIES = 50;

interface ThumbnailRecord {
  projectId: string;
  gz: Blob;
  visitedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.addEventListener("upgradeneeded", () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "projectId" });
      store.createIndex("visitedAt", "visitedAt");
    });
    req.addEventListener("success", () => {
      resolve(req.result);
    });
    req.addEventListener("error", () => {
      // Don't cache a transient open failure
      // let the next call retry instead of disabling thumbnails for the session.
      dbPromise = null;
      reject(req.error ?? new Error("Failed to open IndexedDB"));
    });
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", () => {
      resolve(req.result);
    });
    req.addEventListener("error", () => {
      reject(req.error ?? new Error("IndexedDB request failed"));
    });
  });
}

async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).blob();
}

async function gunzip(gz: Blob): Promise<string> {
  const stream = gz.stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

// Count and cursor must share one transaction with no `await` between requests,
// or the transaction auto-commits while suspended. The cursor walks the
// visitedAt index oldest-first and drops entries beyond MAX_ENTRIES.
function evict(conn: IDBDatabase): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const objectStore = conn.transaction(STORE, "readwrite").objectStore(STORE);
    const countReq = objectStore.count();
    countReq.addEventListener("error", () => {
      reject(countReq.error ?? new Error("IndexedDB count failed"));
    });
    countReq.addEventListener("success", () => {
      let toDrop = countReq.result - MAX_ENTRIES;
      if (toDrop <= 0) {
        resolve();
        return;
      }
      const cursorReq = objectStore.index("visitedAt").openCursor();
      cursorReq.addEventListener("error", () => {
        reject(cursorReq.error ?? new Error("IndexedDB cursor failed"));
      });
      cursorReq.addEventListener("success", () => {
        const cursor = cursorReq.result;
        if (!cursor || toDrop <= 0) {
          resolve();
          return;
        }
        cursor.delete();
        toDrop--;
        cursor.continue();
      });
    });
  });
}

// visitedAt is set on write only — a "visit" is entering the project (when a
// fresh thumbnail is produced), so dashboard reads don't perturb LRU order.
export async function putThumbnail(projectId: string, svg: string): Promise<void> {
  const record: ThumbnailRecord = { projectId, gz: await gzip(svg), visitedAt: Date.now() };
  const conn = await db();
  await promisify(conn.transaction(STORE, "readwrite").objectStore(STORE).put(record));
  await evict(conn);
}

// A cache read must never throw to the UI: ProjectCard reads this inside a memo
// with no ErrorBoundary above it, so a failure (IndexedDB unavailable, corrupt
// entry) degrades to the project-name fallback rather than breaking the render.
export async function getThumbnail(projectId: string): Promise<string | null> {
  try {
    const conn = await db();
    const req = conn.transaction(STORE, "readonly").objectStore(STORE).get(projectId);
    const record = (await promisify(req)) as ThumbnailRecord | undefined;
    return record ? await gunzip(record.gz) : null;
  } catch (error) {
    console.warn("[thumbnail] read failed", error);
    return null;
  }
}

export async function deleteThumbnail(projectId: string): Promise<void> {
  const conn = await db();
  await promisify(conn.transaction(STORE, "readwrite").objectStore(STORE).delete(projectId));
}
