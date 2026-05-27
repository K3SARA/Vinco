import { PrismaClient } from '@prisma/client';
import { calculateSupplierBalanceAfter } from '../utils/ledger.js';

const prisma = new PrismaClient();

export async function getSuppliers(req, res) {
  const { search, status } = req.query;

  try {
    const where = {};
    if (status) {
      where.status = status;
    }

    let suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (search) {
      const q = search.toLowerCase();
      suppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    }

    return res.json(suppliers);
  } catch (error) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getSupplierById(req, res) {
  const { id } = req.params;
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { date: 'desc' },
          take: 5
        },
        payments: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    return res.json(supplier);
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createSupplier(req, res) {
  const { name, phone, address, email, openingBalance, notes, status } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Supplier name and phone number are required.' });
  }

  const opBal = parseFloat(openingBalance) || 0.0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          name,
          phone,
          address: address || '',
          email,
          openingBalance: opBal,
          currentBalance: opBal,
          notes,
          status: status || 'Active',
        },
      });

      // Supplier Ledger: credit increases balance, debit reduces balance
      if (opBal > 0) {
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            transactionType: 'ADJUSTMENT',
            referenceNo: 'OPENING_BAL',
            description: 'Opening balance setup (Credit)',
            debit: 0,
            credit: opBal,
            balanceAfter: opBal,
          },
        });
      } else if (opBal < 0) {
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            transactionType: 'ADJUSTMENT',
            referenceNo: 'OPENING_BAL',
            description: 'Opening balance setup (Debit)',
            debit: Math.abs(opBal),
            credit: 0,
            balanceAfter: opBal,
          },
        });
      }

      return supplier;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier phone number already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateSupplier(req, res) {
  const { id } = req.params;
  const { name, phone, address, email, notes, status } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Supplier name and phone number are required.' });
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        phone,
        address: address || '',
        email,
        notes,
        status: status || 'Active',
      },
    });
    return res.json(supplier);
  } catch (error) {
    console.error('Update supplier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier phone number already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteSupplier(req, res) {
  const { id } = req.params;

  try {
    const purchases = await prisma.purchase.count({ where: { supplierId: id } });

    if (purchases > 0) {
      return res.status(400).json({
        error: 'Cannot delete supplier with purchasing history. Try marking them as Inactive instead.'
      });
    }

    await prisma.supplier.delete({ where: { id } });
    return res.json({ message: 'Supplier deleted successfully.' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getSupplierLedger(req, res) {
  const { id } = req.params;
  try {
    const ledger = await prisma.supplierLedger.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(ledger);
  } catch (error) {
    console.error('Get supplier ledger error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function addPaymentMade(req, res) {
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
      const supplier = await tx.supplier.findUnique({ where: { id } });
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Generate payment number
      const paymentCount = await tx.supplierPayment.count();
      const paymentNumber = `SPAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;

      // Create Payment
      const payment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId: id,
          date: date ? new Date(date) : new Date(),
          amount: paymentAmt,
          paymentMethod,
          referenceNumber,
          notes,
        },
      });

      // Calculate balance after: previousBalance + credit(0) - debit(amount)
      const balanceAfter = calculateSupplierBalanceAfter(supplier.currentBalance, paymentAmt, 0);

      // Create SupplierLedger Debit
      await tx.supplierLedger.create({
        data: {
          supplierId: id,
          transactionType: 'PAYMENT',
          referenceNo: paymentNumber,
          description: notes || `Payment made via ${paymentMethod}`,
          debit: paymentAmt,
          credit: 0,
          balanceAfter,
        },
      });

      // Update supplier balance
      await tx.supplier.update({
        where: { id },
        data: { currentBalance: balanceAfter },
      });

      return payment;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Supplier payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}

export async function addAdjustment(req, res) {
  const { id } = req.params;
  const { amount, type, description, date } = req.body; // type: DEBIT (reduces balance) or CREDIT (increases balance)

  const adjustAmt = parseFloat(amount);
  if (isNaN(adjustAmt) || adjustAmt <= 0) {
    return res.status(400).json({ error: 'Adjustment amount must be greater than zero.' });
  }
  if (type !== 'DEBIT' && type !== 'CREDIT') {
    return res.status(400).json({ error: 'Adjustment type must be DEBIT or CREDIT.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id } });
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const debit = type === 'DEBIT' ? adjustAmt : 0;
      const credit = type === 'CREDIT' ? adjustAmt : 0;

      const balanceAfter = calculateSupplierBalanceAfter(supplier.currentBalance, debit, credit);

      const refNo = `SADJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      // Create Ledger Entry
      await tx.supplierLedger.create({
        data: {
          supplierId: id,
          date: date ? new Date(date) : new Date(),
          transactionType: 'ADJUSTMENT',
          referenceNo: refNo,
          description: description || `Adjustment: ${type}`,
          debit,
          credit,
          balanceAfter,
        },
      });

      // Update supplier balance
      await tx.supplier.update({
        where: { id },
        data: { currentBalance: balanceAfter },
      });

      return { balanceAfter, referenceNo: refNo };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Supplier adjustment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
