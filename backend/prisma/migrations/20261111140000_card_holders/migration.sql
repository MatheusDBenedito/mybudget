-- Card holders: the main holder plus supplementary cards, sharing limit and invoice.
CREATE TABLE "CardHolder" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last4" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardHolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardHolder_creditCardId_name_key" ON "CardHolder"("creditCardId", "name");
CREATE INDEX "CardHolder_creditCardId_idx" ON "CardHolder"("creditCardId");

-- Only one main holder per card (not representable in the Prisma schema).
CREATE UNIQUE INDEX "CardHolder_one_main_per_card" ON "CardHolder"("creditCardId") WHERE "isMain" = true;

-- Seed the main holder for every existing card.
INSERT INTO "CardHolder" ("id", "creditCardId", "name", "isMain", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'Matheus', true, now(), now()
FROM "CreditCard" c;

-- Seed the supplementary holder on the favorite card (C6 Carbon).
INSERT INTO "CardHolder" ("id", "creditCardId", "name", "isMain", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'Adicional', false, now(), now()
FROM "CreditCard" c
WHERE c."isPrimary" = true
  AND c."name" ILIKE '%C6%';

-- Link every existing transaction to its card's main holder.
ALTER TABLE "CardTransaction" ADD COLUMN "cardHolderId" TEXT;

UPDATE "CardTransaction" ct
SET "cardHolderId" = ch."id"
FROM "CardHolder" ch
WHERE ch."creditCardId" = ct."creditCardId"
  AND ch."isMain" = true;

ALTER TABLE "CardTransaction" ALTER COLUMN "cardHolderId" SET NOT NULL;

CREATE INDEX "CardTransaction_cardHolderId_idx" ON "CardTransaction"("cardHolderId");

ALTER TABLE "CardTransaction"
ADD CONSTRAINT "CardTransaction_cardHolderId_fkey"
FOREIGN KEY ("cardHolderId") REFERENCES "CardHolder"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
