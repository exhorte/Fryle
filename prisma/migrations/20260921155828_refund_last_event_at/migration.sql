/*
  Warnings:

  - Added the required column `lastEventAt` to the `Refund` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "lastEventAt" TIMESTAMP(3) NOT NULL;
