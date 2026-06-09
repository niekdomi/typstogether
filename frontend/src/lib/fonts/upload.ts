import { api, apiErrorMessage } from "../api";
import { AssetUploadError, type UploadedBlob } from "../assets/upload";

// Upload a font to the project's blob store. Reuses AssetUploadError/UploadedBlob
// from the asset pipeline; fonts are fetched back via the shared `blobUrl`.
export async function uploadFont(projectId: string, file: File): Promise<UploadedBlob> {
  const { data, error } = await api.projects({ id: projectId }).fonts.post({ file });
  if (error) {
    throw new AssetUploadError(apiErrorMessage(error, "Font upload failed."), error.status);
  }
  return data;
}
