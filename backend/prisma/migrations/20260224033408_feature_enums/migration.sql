/*
  Warnings:

  - Changed the type of `type` on the `Transaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL;
