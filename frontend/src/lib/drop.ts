// Helpers for reading dropped OS files/folders. A folder dropped onto the page
// arrives in `DataTransfer.files` as a single unreadable directory "file";
// handing that to an uploader hangs the request. The FileSystem Entry API
// (`webkitGetAsEntry`) is the only way to tell a directory from a file and to
// recurse into it, so all drop handlers funnel through here.

/** A dropped file paired with its sub-directory relative to the drop target
 * ("" for top-level files; nested files carry their folder path). */
export interface DroppedFile {
  file: File;
  subDir: string;
}

/** Promisified `FileSystemFileEntry.file`. */
function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

/** Read a directory entry fully - `readEntries` yields at most ~100 per call. */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        next();
      }, reject);
    };
    next();
  });
}

// Recurse an entry into concrete files, accumulating each one's relative
// sub-directory. Directory entries are walked rather than yielded (an
// unreadable directory "file" would hang the upload).
async function walkEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: DroppedFile[]
): Promise<void> {
  if (entry.isFile) {
    out.push({ file: await entryFile(entry as FileSystemFileEntry), subDir: prefix });
    return;
  }
  if (entry.isDirectory) {
    const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) {
      await walkEntry(child, childPrefix, out);
    }
  }
}

/**
 * Collect every file from a drop, recursing into any dropped directory so a
 * folder brings its whole subtree. Falls back to the flat file list when the
 * entry API is unavailable.
 *
 * Call this synchronously from the drop handler: `DataTransfer` items and their
 * entry handles are only valid during the event tick (the synchronous prefix
 * here captures them before the first `await`).
 */
export async function collectDroppedFiles(dt: DataTransfer): Promise<DroppedFile[]> {
  const entries = [...dt.items].map((it) => it.webkitGetAsEntry());
  if (entries.some(Boolean)) {
    const out: DroppedFile[] = [];
    for (const entry of entries) {
      if (entry) {
        await walkEntry(entry, "", out);
      }
    }
    return out;
  }
  return [...dt.files].map((file) => ({ file, subDir: "" }));
}
