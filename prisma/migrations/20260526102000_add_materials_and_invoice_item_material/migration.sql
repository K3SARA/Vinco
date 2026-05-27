-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "materialName" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "materialImage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");
