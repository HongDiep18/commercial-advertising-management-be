-- AlterTable: add ON DELETE CASCADE to chat_sessions.user_id foreign key
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_user_id_fkey";
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
