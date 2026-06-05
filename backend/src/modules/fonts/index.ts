import { Elysia } from "elysia";

import { UnsupportedMediaTypeError } from "../../errors";
import { blobMetaModel } from "../blobs/model";
import { blobService } from "../blobs/service";
import { projectAccessMacro } from "../projects/macro";
import { fontModels, sniffFontMime } from "./model";

export const fontRoutes = new Elysia({ name: "font-routes" })
  .use(projectAccessMacro)
  .model(fontModels)

  // Fonts are stored as `project_blob` rows (reusing the blob store) and
  // referenced from the `fonts` Y.Map; the frontend replays them into the
  // engine via `addFont`. Fetching reuses GET /projects/:id/blobs/:blobId.
  .post(
    "/projects/:id/fonts",
    async ({ project, body }) => {
      const bytes = new Uint8Array(await body.file.arrayBuffer());
      const mime = sniffFontMime(bytes);
      if (!mime) throw new UnsupportedMediaTypeError("Not a TTF, OTF, or TTC font");
      return blobService.storeBytes(project.id, bytes, mime);
    },
    {
      body: "font.upload",
      projectEditor: true,
      response: blobMetaModel,
    }
  );
