import { PrismaClient } from '@prisma/client';
import { calculateSupplierBalanceAfter } from '../utils/ledger.js';

const prisma = new PrismaClient();

export async function getPurchases(req, res) {
  const { search, paymentStatus } = req.query;

  try {
    const where = {};
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    let purchases = await prisma.purchase.findMany({
      where,
      include: { supplier: true },
      orderBy: { date: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      purchases = purchases.filter(p => 
        p.purchaseNumber.toLowerCase().includes(q) ||
        p.supplier.name.toLowerCase().includes(q)
      );
    }

    return res.json(purchases);
  } catch (error) {
    console.error('Get purchases error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getPurchaseById(req, res) {
  const { id } = req.params;
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { product: true }
        },
        payments: true
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found.' });
    }

    return res.json(purchase);
  } catch (error) {
    console.error('Get purchase by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createPurchase(req, res) {
  const {
    supplierId,
    date,
    items, // array of { productId, quantity, costPrice }
    transportCost,
    loadingCost,
    otherCost,
    paidAmount,
    paymentMethod,
    notes
  } = req.body;

  if (!supplierId) {
    return res.status(400).json({ error: 'Supplier is required.' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Purchase must contain at least one item.' });
  }

  const parsedTransport = parseFloat(transportCost) || 0.0;
  const parsedLoading = parseFloat(loadingCost) || 0.0;
  const parsedOther = parseFloat(otherCost) || 0.0;
  const parsedPaidAmount = parseFloat(paidAmount) || 0.0;

  if (parsedPaidAmount < 0) {
    return res.status(400).json({ error: 'Paid amount cannot be negative.' });
  }

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(400).json({ error: 'Selected supplier does not exist.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const purchaseItemsData = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.costPrice);

        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantity must be greater than zero.');
        }
        if (isNaN(price) || price < 0) {
          throw new Error('Cost price cannot be negative.');
        }

        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error('Product not found.');
        }

        const lineTotal = Number((qty * price).toFixed(2));
        subtotal += lineTotal;

        purchaseItemsData.push({
          productId: item.productId,
          productCode: product.code,
          productName: product.name,
          quantity: qty,
          costPrice: price,
          lineTotal,
        });
      }

      const grandTotal = Number((subtotal + parsedTransport + parsedLoading + parsedOther).toFixed(2));
      const balanceAmount = Number((grandTotal - parsedPaidAmount).toFixed(2));

      let paymentStatus = 'CREDIT';
      if (parsedPaidAmount === grandTotal) {
        paymentStatus = 'PAID';
      } else if (parsedPaidAmount > 0 && parsedPaidAmount < grandTotal) {
        paymentStatus = 'PARTIAL';
      }

      // Generate Purchase number
      const purchaseCount = await tx.purchase.count();
      const purchaseNumber = `PUR-${new Date().getFullYear()}-${String(purchaseCount + 1).padStart(4, '0')}`;

      // Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId,
          date: date ? new Date(date) : new Date(),
          subtotal,
          transportCost: parsedTransport,
          loadingCost: parsedLoading,
          otherCost: parsedOther,
          grandTotal,
          paidAmount: parsedPaidAmount,
          balanceAmount,
          paymentStatus,
          notes,
          items: {
            create: purchaseItemsData,
          },
        },
        include: { items: true },
      });

      // Increase stock quantities & add StockMovements
      for (const item of purchase.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        const newStock = prod.stockQty + item.quantity;

        // Also update product's costPrice to latest purchased costPrice
        await tx.product.update({
          where: { id: item.productId },
          data: { 
            stockQty: newStock,
            costPrice: item.costPrice 
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: 'PURCHASE_IN',
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            quantityIn: item.quantity,
            quantityOut: 0,
            balanceAfter: newStock,
            description: `Purchased in Purchase ${purchaseNumber}`,
          },
        });
      }

      // Update Supplier Ledger: credit increases balance, debit reduces balance
      let currentSupplierBalance = supplier.currentBalance;
      let balanceAfterPurchase = calculateSupplierBalanceAfter(currentSupplierBalance, 0, grandTotal);

      await tx.supplierLedger.create({
        data: {
          supplierId,
          date: purchase.date,
          transactionType: 'PURCHASE',
          referenceNo: purchaseNumber,
          description: `Inventory Purchase - ${purchaseNumber}`,
          debit: 0,
          credit: grandTotal,
          balanceAfter: balanceAfterPurchase,
        },
      });

      currentSupplierBalance = balanceAfterPurchase;

      // Handle payment if made
      if (parsedPaidAmount > 0) {
        let balanceAfterPayment = calculateSupplierBalanceAfter(currentSupplierBalance, parsedPaidAmount, 0);

        await tx.supplierLedger.create({
          data: {
            supplierId,
            date: purchase.date,
            transactionType: 'PAYMENT',
            referenceNo: purchaseNumber,
            description: `Payment on Purchase - ${purchaseNumber}`,
            debit: parsedPaidAmount,
            credit: 0,
            balanceAfter: balanceAfterPayment,
          },
        });

        // Supplier payment record
        const sPaymentCount = await tx.supplierPayment.count();
        const sPaymentNo = `SPAY-${new Date().getFullYear()}-${String(sPaymentCount + 1).padStart(4, '0')}`;
        await tx.supplierPayment.create({
          data: {
            paymentNumber: sPaymentNo,
            supplierId,
            purchaseId: purchase.id,
            date: purchase.date,
            amount: parsedPaidAmount,
            paymentMethod: paymentMethod || 'Bank Transfer',
            notes: `Initial payment on Purchase ${purchaseNumber}`,
          },
        });

        currentSupplierBalance = balanceAfterPayment;
      }

      // Update Supplier currentBalance
      await tx.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: currentSupplierBalance },
      });

      return purchase;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create purchase error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function addPurchasePayment(req, res) {
  const { id } = req.params;
  const { amount, paymentMethod, referenceNumber, notes, date } = req.body;

  const paymentAmt = parseFloat(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }
  if (!paymentMethod) {
    return res.status(400).json({ error: 'Payment method is required.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: { supplier: true },
      });

      if (!purchase) {
        throw new Error('Purchase not found.');
      }
      if (purchase.balanceAmount <= 0) {
        throw new Error('Purchase is already fully paid.');
      }
      if (purchase.paymentStatus === 'CANCELLED') {
        throw new Error('Cannot add payment to a cancelled purchase.');
      }

      const newPaid = Number((purchase.paidAmount + paymentAmt).toFixed(2));
      const newBalance = Number((purchase.grandTotal - newPaid).toFixed(2));

      if (newBalance < 0) {
        throw new Error(`Payment exceeds purchase outstanding balance. Outstanding: ${purchase.balanceAmount}`);
      }

      let paymentStatus = 'PARTIAL';
      if (newBalance === 0) {
        paymentStatus = 'PAID';
      }

      // Update Purchase
      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus,
        },
      });

      // Create SupplierPayment record
      const sPaymentCount = await tx.supplierPayment.count();
      const sPaymentNo = `SPAY-${new Date().getFullYear()}-${String(sPaymentCount + 1).padStart(4, '0')}`;
      await tx.supplierPayment.create({
        data: {
          paymentNumber: sPaymentNo,
          supplierId: purchase.supplierId,
          purchaseId: id,
          date: date ? new Date(date) : new Date(),
          amount: paymentAmt,
          paymentMethod,
          referenceNumber,
          notes,
        },
      });

      // Update supplier ledger: debit the payment (reduces balance)
      const balanceAfter = calculateSupplierBalanceAfter(purchase.supplier.currentBalance, paymentAmt, 0);

      await tx.supplierLedger.create({
        data: {
          supplierId: purchase.supplierId,
          date: date ? new Date(date) : new Date(),
          transactionType: 'PAYMENT',
          referenceNo: purchase.purchaseNumber,
          description: `Payment on Purchase ${purchase.purchaseNumber}`,
          debit: paymentAmt,
          credit: 0,
          balanceAfter,
        },
      });

      // Update supplier current balance
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { currentBalance: balanceAfter },
      });

      return updatedPurchase;
    });

    return res.json(result);
  } catch (error) {
    console.error('Purchase payment error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function deletePurchase(req, res) {
  const { id } = req.params;

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can delete purchases.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: { supplier: true, items: true },
      });

      if (!purchase) {
        throw new Error('Purchase not found.');
      }

      // Restoring stock quantities (decrements stockQty since purchase introduced them)
      for (const item of purchase.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        const restoredStock = prod.stockQty - item.quantity;
        
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: restoredStock },
        });

        // Log StockMovement release/reversal
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: 'ADJUSTMENT_OUT',
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            quantityIn: 0,
            quantityOut: item.quantity,
            balanceAfter: restoredStock,
            description: `Reversal - Deleted Purchase Record ${purchase.purchaseNumber}`,
          },
        });
      }

      // Reverse Supplier Ledger
      let currentBalance = purchase.supplier.currentBalance;

      // Debit the credited grandTotal
      let balanceAfterReversePurchase = calculateSupplierBalanceAfter(currentBalance, purchase.grandTotal, 0);
      await tx.supplierLedger.create({
        data: {
          supplierId: purchase.supplierId,
          transactionType: 'ADJUSTMENT',
          referenceNo: purchase.purchaseNumber,
          description: `Deleted Purchase Reversal - ${purchase.purchaseNumber}`,
          debit: purchase.grandTotal,
          credit: 0,
          balanceAfter: balanceAfterReversePurchase,
        },
      });

      currentBalance = balanceAfterReversePurchase;

      // Credit the paidAmount debit (refund)
      if (purchase.paidAmount > 0) {
        let balanceAfterReversePayment = calculateSupplierBalanceAfter(currentBalance, 0, purchase.paidAmount);
        await tx.supplierLedger.create({
          data: {
            supplierId: purchase.supplierId,
            transactionType: 'ADJUSTMENT',
            referenceNo: purchase.purchaseNumber,
            description: `Deleted Purchase Payment Reversal - ${purchase.purchaseNumber}`,
            debit: 0,
            credit: purchase.paidAmount,
            balanceAfter: balanceAfterReversePayment,
          },
        });

        currentBalance = balanceAfterReversePayment;
      }

      // Update supplier balance in DB
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { currentBalance },
      });

      // Delete payments
      await tx.supplierPayment.deleteMany({ where: { purchaseId: id } });

      // Delete purchase items and purchase
      await tx.purchase.delete({ where: { id } });

      return { purchaseNo: purchase.purchaseNumber };
    });

    return res.json({ message: 'Purchase deleted successfully and stock reversed.', result });
  } catch (error) {
    console.error('Delete purchase error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}
