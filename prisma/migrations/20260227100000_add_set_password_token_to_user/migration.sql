-- AlterTable
ALTER TABLE "users" ADD COLUMN "setPasswordToken" VARCHAR(255),
ADD COLUMN "setPasswordTokenExpiresAt" TIMESTAMP(3);
