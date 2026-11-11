-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "yieldSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccountYield" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cdiDailyRate" DOUBLE PRECISION NOT NULL,
    "cdiPercentage" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountYield_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountYield_accountId_date_key" ON "AccountYield"("accountId", "date");

-- AddForeignKey
ALTER TABLE "AccountYield" ADD CONSTRAINT "AccountYield_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
