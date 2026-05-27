import { PrismaClient } from '@prisma/client';
import { calculateCustomerBalanceAfter } from '../utils/ledger.js';

const prisma = new PrismaClient();

export async function getCustomers(req, res) {
  const { search, status } = req.query;

  try {
    const where = {};
    if (status) {
      where.status = status;
    }

    let customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    }

    return res.json(customers);
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getCustomerById(req, res) {
  const { id } = req.params;
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { date: 'desc' },
          take: 5
        },
        orders: {
          orderBy: { orderDate: 'desc' },
          take: 5
        },
        payments: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    return res.json(customer);
  } catch (error) {
    console.error('Get customer by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createCustomer(req, res) {
  const { name, phone, address, email, openingBalance, notes, status } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }

  const opBal = parseFloat(openingBalance) || 0.0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
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

      // If opening balance > 0, we log it as initial debit ledger entry
      if (opBal > 0) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionType: 'ADJUSTMENT',
            referenceNo: 'OPENING_BAL',
            description: 'Opening balance setup',
            debit: opBal,
            credit: 0,
            balanceAfter: opBal,
          },
        });
      } else if (opBal < 0) {
        // If customer has overpaid at the start
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionType: 'ADJUSTMENT',
            referenceNo: 'OPENING_BAL',
            description: 'Opening balance setup (Credit)',
            debit: 0,
            credit: Math.abs(opBal),
            balanceAfter: opBal,
          },
        });
      }

      return customer;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create customer error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Customer phone number already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateCustomer(req, res) {
  const { id } = req.params;
  const { name, phone, address, email, notes, status } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }

  try {
    const customer = await prisma.customer.update({
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
    return res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Customer phone number already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteCustomer(req, res) {
  const { id } = req.params;

  try {
    const invoices = await prisma.invoice.count({ where: { customerId: id } });
    const orders = await prisma.order.count({ where: { customerId: id } });

    if (invoices > 0 || orders > 0) {
      return res.status(400).json({
        error: 'Cannot delete customer that has billing transactions or orders. Try marking them as Inactive instead.'
      });
    }

    await prisma.customer.delete({ where: { id } });
    return res.json({ message: 'Customer deleted successfully.' });
  } catch (error) {
    console.error('Delete customer error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getCustomerLedger(req, res) {
  const { id } = req.params;
  try {
    const ledger = await prisma.customerLedger.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(ledger);
  } catch (error) {
    console.error('Get customer ledger error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function addPaymentReceived(req, res) {
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
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Generate payment number
      const paymentCount = await tx.payment.count();
      const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId: id,
          date: date ? new Date(date) : new Date(),
          amount: paymentAmt,
          paymentMethod,
          referenceNumber,
          notes,
        },
      });

      // Calculate balance after: previousBalance + debit(0) - credit(amount)
      const balanceAfter = calculateCustomerBalanceAfter(customer.currentBalance, 0, paymentAmt);

      // Create CustomerLedger Credit
      await tx.customerLedger.create({
        data: {
          customerId: id,
          transactionType: 'PAYMENT',
          referenceNo: paymentNumber,
          description: notes || `Payment received via ${paymentMethod}`,
          debit: 0,
          credit: paymentAmt,
          balanceAfter,
        },
      });

      // Update customer balance
      await tx.customer.update({
        where: { id },
        data: { currentBalance: balanceAfter },
      });

      return payment;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Customer payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}

export async function addAdjustment(req, res) {
  const { id } = req.params;
  const { amount, type, description, date } = req.body; // type: DEBIT (increases balance) or CREDIT (reduces balance)

  const adjustAmt = parseFloat(amount);
  if (isNaN(adjustAmt) || adjustAmt <= 0) {
    return res.status(400).json({ error: 'Adjustment amount must be greater than zero.' });
  }
  if (type !== 'DEBIT' && type !== 'CREDIT') {
    return res.status(400).json({ error: 'Adjustment type must be DEBIT or CREDIT.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) {
        throw new Error('Customer not found');
      }

      const debit = type === 'DEBIT' ? adjustAmt : 0;
      const credit = type === 'CREDIT' ? adjustAmt : 0;

      const balanceAfter = calculateCustomerBalanceAfter(customer.currentBalance, debit, credit);

      const refNo = `ADJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      // Create Ledger Entry
      await tx.customerLedger.create({
        data: {
          customerId: id,
          date: date ? new Date(date) : new Date(),
          transactionType: 'ADJUSTMENT',
          referenceNo: refNo,
          description: description || `Adjustment: ${type}`,
          debit,
          credit,
          balanceAfter,
        },
      });

      // Update customer balance
      await tx.customer.update({
        where: { id },
        data: { currentBalance: balanceAfter },
      });

      return { balanceAfter, referenceNo: refNo };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Customer adjustment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
