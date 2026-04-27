DROP INDEX "project_slug_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "project_slug_unique" ON "project" USING btree ("slug","owner_user_id");