-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'YIELDING');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "cdiPercentage" DOUBLE PRECISION,
ADD COLUMN     "type" "AccountType" NOT NULL DEFAULT 'CHECKING';
