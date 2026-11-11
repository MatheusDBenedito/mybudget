-- Favorite card shown first on the summary and card pages
ALTER TABLE "CreditCard" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- The C6 Carbon is the main card; only if it does not exist, fall back to the oldest card
UPDATE "CreditCard" SET "isPrimary" = true
WHERE "id" = 'd6443ae6-1298-464f-8d9c-3d58ec71b3c1';

UPDATE "CreditCard" SET "isPrimary" = true
WHERE "isPrimary" = false
  AND NOT EXISTS (SELECT 1 FROM "CreditCard" WHERE "isPrimary" = true)
  AND "id" = (SELECT "id" FROM "CreditCard" ORDER BY "createdAt" ASC LIMIT 1);
