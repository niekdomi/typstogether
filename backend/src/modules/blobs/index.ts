import { Elysia } from "elysia";

import { projectAccessMacro } from "../projects/macro";
import { blobMetaModel, blobModels } from "./model";
import { blobService } from "./service";

export const blobRoutes = new Elysia({ name: "blob-routes" })
  .use(projectAccessMacro)
  .model(blobModels)

  .post("/projects/:id/blobs", ({ project, body }) => blobService.store(project.id, body.file), {
    body: "blob.upload",
    projectEditor: true,
    response: blobMetaModel,
  })

  .get(
    "/projects/:id/blobs/:sha256",
    async ({ project, params, set }) => {
      const blob = await blobService.fetch(project.id, params.sha256);
      set.headers["content-type"] = blob.mime;
      set.headers["x-content-type-options"] = "nosniff";
      set.headers["cache-control"] = "private, max-age=31536000, immutable";
      set.headers.etag = `"${blob.sha256}"`;
      return new Response(blob.bytes);
    },
    {
      params: "blob.byShaParams",
      projectMember: true,
    }
  );
