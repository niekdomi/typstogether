ALTER TABLE "project_blob" ADD COLUMN "pending_gc_at" timestamp;--> statement-breakpoint
CREATE INDEX "project_blob_pending_gc_at_idx" ON "project_blob" USING btree ("pending_gc_at");