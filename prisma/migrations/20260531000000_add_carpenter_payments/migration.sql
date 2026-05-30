-- CreateTable
CREATE TABLE "Carpenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDailyPayment" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carpenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarpenterPayment" (
    "id" TEXT NOT NULL,
    "carpenterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarpenterPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CarpenterPayment" ADD CONSTRAINT "CarpenterPayment_carpenterId_fkey" FOREIGN KEY ("carpenterId") REFERENCES "Carpenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
