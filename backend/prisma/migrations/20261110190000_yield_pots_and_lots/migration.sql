-- DropIndex
DROP INDEX "AccountYield_accountId_date_key";

-- AlterTable
ALTER TABLE "AccountYield" ADD COLUMN     "bucket" TEXT NOT NULL DEFAULT 'main';

-- CreateTable
CREATE TABLE "YieldPot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cdiPercentage" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YieldPot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotMovement" (
    "id" TEXT NOT NULL,
    "potId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PotMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountYield_accountId_bucket_date_key" ON "AccountYield"("accountId", "bucket", "date");

-- AddForeignKey
ALTER TABLE "YieldPot" ADD CONSTRAINT "YieldPot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotMovement" ADD CONSTRAINT "PotMovement_potId_fkey" FOREIGN KEY ("potId") REFERENCES "YieldPot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
