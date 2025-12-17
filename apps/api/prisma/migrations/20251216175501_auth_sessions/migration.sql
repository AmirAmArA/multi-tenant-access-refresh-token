/*
  Warnings:

  - You are about to drop the column `token` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tokenHash]` on the table `RefreshToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revokedAt` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenHash` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RefreshToken_token_key";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "token",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
