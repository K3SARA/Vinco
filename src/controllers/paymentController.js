import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getPayments(req, res) {
  const { customerId } = req.query;

  try {
    const where = {};
    if (customerId) {
      where.customerId = customerId;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: true,
        invoice: true,
        order: true
      },
      orderBy: { date: 'desc' },
    });

    return res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getPendingPayments(req, res) {
  try {
    // Invoices that are CREDIT or PARTIAL
    const invoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: { in: ['CREDIT', 'PARTIAL'] }
      },
      include: { customer: true },
      orderBy: { date: 'asc' }
    });

    // Orders that have balanceAmount > 0
    const orders = await prisma.order.findMany({
      where: {
        balanceAmount: { gt: 0 },
        orderStatus: { not: 'Cancelled' }
      },
      include: { customer: true },
      orderBy: { orderDate: 'asc' }
    });

    return res.json({ invoices, orders });
  } catch (error) {
    console.error('Get pending payments error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getOverduePayments(req, res) {
  try {
    const now = new Date();
    // Fetch installments where status is Pending/Overdue and dueDate is past now
    const overdueInstallments = await prisma.installment.findMany({
      where: {
        status: { in: ['Pending', 'Overdue'] },
        dueDate: { lt: now }
      },
      include: {
        customer: true,
        invoice: true,
        order: true
      },
      orderBy: { dueDate: 'asc' }
    });

    return res.json(overdueInstallments);
  } catch (error) {
    console.error('Get overdue payments error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
