CREATE TABLE "project_blob" (
	"project_id" text NOT NULL,
	"blob_id" text NOT NULL,
	"sha256" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_blob_project_id_blob_id_pk" PRIMARY KEY("project_id","blob_id")
);
--> statement-breakpoint
ALTER TABLE "project_blob" ADD CONSTRAINT "project_blob_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;