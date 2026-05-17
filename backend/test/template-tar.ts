import { gzipSync } from "bun";

export interface TarEntry {
  name: string;
  content: string;
}

function writeAscii(buf: Uint8Array, value: string, offset: number, length: number) {
  const encoded = new TextEncoder().encode(value);
  buf.set(encoded.subarray(0, length), offset);
}

function padOctal(n: number, length: number): string {
  return n.toString(8).padStart(length, "0");
}

/** Builds a minimal ustar archive of regular text files for testing. */
export function buildTar(entries: TarEntry[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const bytes = new TextEncoder().encode(entry.content);
    const header = new Uint8Array(512);
    writeAscii(header, entry.name, 0, 100);
    writeAscii(header, "0000644", 100, 8); // mode
    writeAscii(header, "0000000", 108, 8); // uid
    writeAscii(header, "0000000", 116, 8); // gid
    writeAscii(header, padOctal(bytes.length, 11), 124, 12); // size
    writeAscii(header, "00000000000", 136, 12); // mtime
    header.fill(32, 148, 156); // checksum placeholder
    header[156] = "0".codePointAt(0)!; // typeflag: regular file
    writeAscii(header, "ustar\0", 257, 6);
    writeAscii(header, "00", 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeAscii(header, padOctal(checksum, 6) + "\0 ", 148, 8);
    blocks.push(header);

    const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
    padded.set(bytes);
    blocks.push(padded);
  }
  blocks.push(new Uint8Array(1024)); // end-of-archive: two zero blocks

  const total = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

/** Wraps {@link buildTar} in gzip, returning the bytes a real Typst package response would have. */
export function buildTarGz(entries: TarEntry[]): Uint8Array {
  // Cast through Uint8Array<ArrayBuffer>: gzipSync rejects Uint8Array<ArrayBufferLike>
  // even though the runtime accepts it.
  return gzipSync(buildTar(entries) as Uint8Array<ArrayBuffer>);
}
