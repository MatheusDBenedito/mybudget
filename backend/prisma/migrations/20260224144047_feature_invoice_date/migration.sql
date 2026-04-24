/*
  Warnings:

  - Added the required column `invoiceDate` to the `CardTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CardTransaction" ADD COLUMN     "invoiceDate" TIMESTAMP(3) NOT NULL;
