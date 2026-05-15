import { baseUrl } from "../api";

export interface UploadedBlob {
  id: string;
  sha256: string;
  mime: string;
  size: number;
}

export class AssetUploadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function uploadAsset(projectId: string, file: File): Promise<UploadedBlob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/blobs`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new AssetUploadError(text || res.statusText, res.status);
  }
  return (await res.json()) as UploadedBlob;
}

export function assetBlobUrl(projectId: string, blobId: string): string {
  return `${baseUrl}/api/projects/${projectId}/blobs/${blobId}`;
}
