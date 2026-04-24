-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "averagePrice" DOUBLE PRECISION,
ADD COLUMN     "currentPrice" DOUBLE PRECISION,
ADD COLUMN     "quantity" DOUBLE PRECISION,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "tickerCode" TEXT;
