/*
  Warnings:

  - You are about to drop the column `closingDay` on the `CreditCard` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CreditCard" DROP COLUMN "closingDay",
ADD COLUMN     "invoiceClosingOffset" INTEGER NOT NULL DEFAULT 7;
