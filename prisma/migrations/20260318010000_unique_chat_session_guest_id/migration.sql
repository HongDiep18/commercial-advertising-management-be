-- AlterTable: add UNIQUE constraint on chat_sessions.guest_id to prevent duplicate guest sessions
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_guest_id_key" UNIQUE ("guest_id");
