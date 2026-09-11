/*
  Warnings:

  - Made the column `heading` on table `Note` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "heading" SET NOT NULL;
