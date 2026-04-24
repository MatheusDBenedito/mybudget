-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('FIXED_INCOME', 'VARIABLE_INCOME', 'CRYPTO', 'OTHER');

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestmentType" NOT NULL,
    "investedAmount" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);
