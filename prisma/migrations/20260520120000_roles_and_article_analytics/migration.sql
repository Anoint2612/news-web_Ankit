-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- AlterTable: migrate role from TEXT to UserRole
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE
    WHEN UPPER("role") = 'ADMIN' THEN 'admin'::"UserRole"
    ELSE 'user'::"UserRole"
  END
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';

-- CreateTable
CREATE TABLE "ArticleClick" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "articleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleEngagement" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "articleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleClick_articleId_idx" ON "ArticleClick"("articleId");

-- CreateIndex
CREATE INDEX "ArticleClick_userId_idx" ON "ArticleClick"("userId");

-- CreateIndex
CREATE INDEX "ArticleClick_category_idx" ON "ArticleClick"("category");

-- CreateIndex
CREATE INDEX "ArticleClick_createdAt_idx" ON "ArticleClick"("createdAt");

-- CreateIndex
CREATE INDEX "ArticleEngagement_articleId_idx" ON "ArticleEngagement"("articleId");

-- CreateIndex
CREATE INDEX "ArticleEngagement_category_idx" ON "ArticleEngagement"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleEngagement_userId_articleId_key" ON "ArticleEngagement"("userId", "articleId");

-- AddForeignKey
ALTER TABLE "ArticleClick" ADD CONSTRAINT "ArticleClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleEngagement" ADD CONSTRAINT "ArticleEngagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
