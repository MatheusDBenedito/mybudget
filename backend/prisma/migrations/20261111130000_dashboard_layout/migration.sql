-- Customizable summary layout: order and width of the dashboard blocks.
-- Single-user app, so the layout is stored as a singleton row.
CREATE TABLE "DashboardLayout" (
    "id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);
