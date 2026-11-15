-- CreateEnum
CREATE TYPE "AmortizationSystem" AS ENUM ('SAC', 'PRICE');

-- CreateEnum
CREATE TYPE "FinancingIndexer" AS ENUM ('TR', 'IPCA', 'POUPANCA', 'FIXO');

-- CreateEnum
CREATE TYPE "FinancingInstallmentStatus" AS ENUM ('PAID', 'PENDING');

-- CreateEnum
CREATE TYPE "ExtraAmortizationStrategy" AS ENUM ('REDUCE_TERM', 'REDUCE_INSTALLMENT');

-- CreateEnum
CREATE TYPE "ExtraAmortizationSource" AS ENUM ('OWN_FUNDS', 'FGTS');

-- CreateTable
CREATE TABLE "Financing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "contractNumber" TEXT,
    "propertyAddress" TEXT,
    "system" "AmortizationSystem" NOT NULL DEFAULT 'SAC',
    "indexer" "FinancingIndexer" NOT NULL DEFAULT 'TR',
    "propertyValue" DOUBLE PRECISION NOT NULL,
    "downPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "financedAmount" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "nominalRateAnnual" DOUBLE PRECISION NOT NULL,
    "effectiveRateAnnual" DOUBLE PRECISION,
    "cetAnnual" DOUBLE PRECISION,
    "totalMonths" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL DEFAULT 21,
    "contractDate" TIMESTAMP(3) NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "monthlyAdminFee" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "monthlyInsurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fgtsBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastFgtsUsageDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Financing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingInstallment" (
    "id" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "installmentCode" TEXT NOT NULL,
    "installmentNumber" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "FinancingInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "interestAmount" DOUBLE PRECISION NOT NULL,
    "mipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dfiAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tsaAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monetaryCorrection" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingExtraAmortization" (
    "id" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "strategy" "ExtraAmortizationStrategy" NOT NULL DEFAULT 'REDUCE_TERM',
    "source" "ExtraAmortizationSource" NOT NULL DEFAULT 'OWN_FUNDS',
    "installmentsReduced" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingExtraAmortization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Financing_workspaceId_idx" ON "Financing"("workspaceId");

-- CreateIndex
CREATE INDEX "FinancingInstallment_financingId_status_idx" ON "FinancingInstallment"("financingId", "status");

-- CreateIndex
CREATE INDEX "FinancingInstallment_financingId_dueDate_idx" ON "FinancingInstallment"("financingId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingInstallment_financingId_installmentCode_key" ON "FinancingInstallment"("financingId", "installmentCode");

-- CreateIndex
CREATE INDEX "FinancingExtraAmortization_financingId_date_idx" ON "FinancingExtraAmortization"("financingId", "date");

-- AddForeignKey
ALTER TABLE "Financing" ADD CONSTRAINT "Financing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingInstallment" ADD CONSTRAINT "FinancingInstallment_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "Financing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingExtraAmortization" ADD CONSTRAINT "FinancingExtraAmortization_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "Financing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
