import { api, baseUrl } from "../api";

export interface UploadedBlob {
  id: string;
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
  const { data, error } = await api.projects({ id: projectId }).blobs.post({ file });
  if (error) {
    const message = typeof error.value === "string" ? error.value : JSON.stringify(error.value);
    throw new AssetUploadError(message, error.status);
  }
  return data;
}

export function blobUrl(projectId: string, blobId: string): string {
  return `${baseUrl}/api/projects/${projectId}/blobs/${blobId}`;
}
