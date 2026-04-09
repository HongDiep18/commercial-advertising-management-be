-- LangGraph PostgreSQL checkpointer tables.
-- These are managed by the @langchain/langgraph-checkpoint-postgres library,
-- not by this application. Tracked here only to prevent Prisma drift detection.

CREATE TABLE IF NOT EXISTS "public"."checkpoint_blobs" (
    "thread_id" text NOT NULL,
    "checkpoint_ns" text DEFAULT ''::text NOT NULL,
    "channel" text NOT NULL,
    "version" text NOT NULL,
    "type" text NOT NULL,
    "blob" bytea,
    CONSTRAINT "checkpoint_blobs_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "channel", "version")
);

CREATE TABLE IF NOT EXISTS "public"."checkpoint_migrations" (
    "v" integer NOT NULL,
    CONSTRAINT "checkpoint_migrations_pkey" PRIMARY KEY ("v")
);

CREATE TABLE IF NOT EXISTS "public"."checkpoint_writes" (
    "thread_id" text NOT NULL,
    "checkpoint_ns" text DEFAULT ''::text NOT NULL,
    "checkpoint_id" text NOT NULL,
    "task_id" text NOT NULL,
    "idx" integer NOT NULL,
    "channel" text NOT NULL,
    "type" text,
    "blob" bytea NOT NULL,
    CONSTRAINT "checkpoint_writes_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx")
);

CREATE TABLE IF NOT EXISTS "public"."checkpoints" (
    "thread_id" text NOT NULL,
    "checkpoint_ns" text DEFAULT ''::text NOT NULL,
    "checkpoint_id" text NOT NULL,
    "parent_checkpoint_id" text,
    "type" text,
    "checkpoint" jsonb NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id")
);
