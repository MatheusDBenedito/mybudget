-- CreateTable
CREATE TABLE IF NOT EXISTS "InvestmentGoal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usePortfolioAsInitial" BOOLEAN NOT NULL DEFAULT false,
    "monthlySalary" DOUBLE PRECISION NOT NULL,
    "monthlyExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emergencyReserveMonths" INTEGER NOT NULL DEFAULT 6,
    "savingsRatePct" DOUBLE PRECISION NOT NULL,
    "cdiPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "cdiAnnualRatePct" DOUBLE PRECISION,
    "horizonMonths" INTEGER NOT NULL DEFAULT 120,
    "targetAmount" DOUBLE PRECISION,
    "startMonth" INTEGER,
    "startYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvestmentGoal_workspaceId_idx" ON "InvestmentGoal"("workspaceId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InvestmentGoal_workspaceId_fkey'
    ) THEN
        ALTER TABLE "InvestmentGoal"
        ADD CONSTRAINT "InvestmentGoal_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
