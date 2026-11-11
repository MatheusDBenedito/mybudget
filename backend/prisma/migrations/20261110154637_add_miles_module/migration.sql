-- CreateEnum
CREATE TYPE "MilesStatus" AS ENUM ('PENDING', 'TRANSFERRED', 'CREDITED');

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "loyaltyProgram" TEXT,
ADD COLUMN     "pointsPerDollar" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MilesEntry" (
    "id" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "MilesStatus" NOT NULL DEFAULT 'PENDING',
    "expectedCreditDate" TIMESTAMP(3) NOT NULL,
    "creditCardId" TEXT,
    "origin" TEXT,
    "referenceMonth" INTEGER,
    "referenceYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilesEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilesEntry_status_idx" ON "MilesEntry"("status");

-- CreateIndex
CREATE INDEX "MilesEntry_expectedCreditDate_idx" ON "MilesEntry"("expectedCreditDate");

-- AddForeignKey
ALTER TABLE "MilesEntry" ADD CONSTRAINT "MilesEntry_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
