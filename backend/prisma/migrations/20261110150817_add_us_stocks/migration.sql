-- AlterEnum
ALTER TYPE "InvestmentType" ADD VALUE 'US_STOCK';

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "purchaseExchangeRate" DOUBLE PRECISION;
