import { PrismaClient } from '@prisma/client';
import { invalidateCache } from '../utils/cache.js';

const prisma = new PrismaClient();

const CARPENTER_TRANSACTION_TYPES = new Set(['PAYMENT', 'CREDIT']);

function invalidateCarpenterRelatedCache() {
  invalidateCache('dashboard:');
}

function normalizeCarpenterTransactionType(value = 'PAYMENT') {
  const normalized = String(value || 'PAYMENT').trim().toUpperCase();
  if (['RECEIVED', 'RECEIPT', 'DEDUCTION'].includes(normalized)) {
    return 'CREDIT';
  }
  return normalized;
}

function getEmptyCarpenterAccountSummary() {
  return {
    totalPaid: 0,
    totalCredit: 0,
    netBalance: 0,
  };
}

function summarizeCarpenterTransactions(payments = []) {
  const summary = getEmptyCarpenterAccountSummary();

  for (const payment of payments) {
    const amount = Number(payment.amount || 0);
    const transactionType = normalizeCarpenterTransactionType(payment.transactionType);

    if (transactionType === 'CREDIT') {
      summary.totalCredit += amount;
    } else {
      summary.totalPaid += amount;
    }
  }

  summary.netBalance = summary.totalPaid - summary.totalCredit;
  return summary;
}

function parseLedgerDateRange({ from, to }) {
  const range = {};

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      fromDate.setHours(0, 0, 0, 0);
      range.from = fromDate;
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      range.to = toDate;
    }
  }

  return range;
}

function isInsideLedgerDateRange(date, { from, to }) {
  const entryDate = new Date(date);
  if (from && entryDate < from) return false;
  if (to && entryDate > to) return false;
  return true;
}

function buildCarpenterLedgerEntries(payments = [], dateRange = {}) {
  let runningBalance = 0;
  let openingBalance = 0;
  let closingBalance = 0;
  let hasPeriodEntry = false;
  const entries = [];
  const periodSummary = getEmptyCarpenterAccountSummary();

  for (const payment of payments) {
    const transactionType = normalizeCarpenterTransactionType(payment.transactionType);
    const amount = Number(payment.amount || 0);
    const balanceBefore = runningBalance;
    const signedAmount = transactionType === 'CREDIT' ? -amount : amount;
    const entryDate = new Date(payment.date);

    runningBalance += signedAmount;

    if (!isInsideLedgerDateRange(payment.date, dateRange)) {
      if (dateRange.from && entryDate < dateRange.from) {
        openingBalance = runningBalance;
      }
      continue;
    }

    if (!hasPeriodEntry) {
      openingBalance = balanceBefore;
      hasPeriodEntry = true;
    }
    closingBalance = runningBalance;

    if (transactionType === 'CREDIT') {
      periodSummary.totalCredit += amount;
    } else {
      periodSummary.totalPaid += amount;
    }

    entries.push({
      id: payment.id,
      date: payment.date,
      referenceNo: `CP-${String(payment.id).slice(0, 8).toUpperCase()}`,
      transactionType,
      description: payment.notes || (transactionType === 'CREDIT' ? 'Received / credit from carpenter' : 'Payment / advance to carpenter'),
      amount,
      paid: transactionType === 'PAYMENT' ? amount : 0,
      credit: transactionType === 'CREDIT' ? amount : 0,
      balanceBefore,
      balanceAfter: runningBalance,
      createdAt: payment.createdAt,
    });
  }

  periodSummary.netBalance = periodSummary.totalPaid - periodSummary.totalCredit;

  return {
    entries: entries.reverse(),
    openingBalance,
    closingBalance: hasPeriodEntry ? closingBalance : openingBalance,
    accountBalance: runningBalance,
    totalPaid: periodSummary.totalPaid,
    totalCredit: periodSummary.totalCredit,
    netBalance: periodSummary.netBalance,
  };
}

export async function getCarpenters(req, res) {
  const { search = '', active = '' } = req.query;

  try {
    const where = {};
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const carpenters = await prisma.carpenter.findMany({
      where,
      include: {
        payments: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
        _count: {
          select: { payments: true },
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    const summariesByCarpenter = new Map();

    if (carpenters.length > 0) {
      const groupedPayments = await prisma.carpenterPayment.groupBy({
        by: ['carpenterId', 'transactionType'],
        where: {
          carpenterId: { in: carpenters.map((carpenter) => carpenter.id) },
        },
        _sum: { amount: true },
      });

      for (const group of groupedPayments) {
        const summary = summariesByCarpenter.get(group.carpenterId) || getEmptyCarpenterAccountSummary();
        const amount = Number(group._sum.amount || 0);
        const transactionType = normalizeCarpenterTransactionType(group.transactionType);

        if (transactionType === 'CREDIT') {
          summary.totalCredit += amount;
        } else {
          summary.totalPaid += amount;
        }
        summary.netBalance = summary.totalPaid - summary.totalCredit;
        summariesByCarpenter.set(group.carpenterId, summary);
      }
    }

    const activeWorkloadByCarpenter = new Map();
    try {
      const groupedOrders = await prisma.customOrder.groupBy({
        by: ['assigned_carpenter_id'],
        where: {
          stage: { in: ['Confirmed', 'In production', 'Ready'] },
          assigned_carpenter_id: { not: null },
        },
        _count: { id: true },
      });
      for (const group of groupedOrders) {
        if (group.assigned_carpenter_id) {
          activeWorkloadByCarpenter.set(group.assigned_carpenter_id, group._count.id);
        }
      }
    } catch (err) {
      console.error('Error grouping carpenter workloads:', err);
    }

    return res.json(carpenters.map((carpenter) => ({
      ...carpenter,
      accountSummary: summariesByCarpenter.get(carpenter.id) || getEmptyCarpenterAccountSummary(),
      activeWorkload: activeWorkloadByCarpenter.get(carpenter.id) || 0,
    })));
  } catch (error) {
    console.error('Get carpenters error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createCarpenter(req, res) {
  const { name, defaultDailyPayment = 0 } = req.body;
  const trimmedName = String(name || '').trim();
  const dailyPayment = parseFloat(defaultDailyPayment || 0);

  if (!trimmedName) {
    return res.status(400).json({ error: 'Carpenter name is required.' });
  }
  if (isNaN(dailyPayment) || dailyPayment < 0) {
    return res.status(400).json({ error: 'Default daily payment must be zero or greater.' });
  }

  try {
    const carpenter = await prisma.carpenter.create({
      data: {
        name: trimmedName,
        defaultDailyPayment: dailyPayment,
      },
    });

    invalidateCarpenterRelatedCache();
    return res.status(201).json(carpenter);
  } catch (error) {
    console.error('Create carpenter error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateCarpenter(req, res) {
  const { id } = req.params;
  const { name, defaultDailyPayment = 0, active = true } = req.body;
  const trimmedName = String(name || '').trim();
  const dailyPayment = parseFloat(defaultDailyPayment || 0);

  if (!trimmedName) {
    return res.status(400).json({ error: 'Carpenter name is required.' });
  }
  if (isNaN(dailyPayment) || dailyPayment < 0) {
    return res.status(400).json({ error: 'Default daily payment must be zero or greater.' });
  }

  try {
    const carpenter = await prisma.carpenter.update({
      where: { id },
      data: {
        name: trimmedName,
        defaultDailyPayment: dailyPayment,
        active: active === true || active === 'true',
      },
    });

    invalidateCarpenterRelatedCache();
    return res.json(carpenter);
  } catch (error) {
    console.error('Update carpenter error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}

export async function deleteCarpenter(req, res) {
  const { id } = req.params;

  try {
    const paymentCount = await prisma.carpenterPayment.count({ where: { carpenterId: id } });

    if (paymentCount > 0) {
      const carpenter = await prisma.carpenter.update({
        where: { id },
        data: { active: false },
      });
      invalidateCarpenterRelatedCache();
      return res.json({ message: 'Carpenter has payment history and was marked inactive.', carpenter });
    }

    await prisma.carpenter.delete({ where: { id } });
    invalidateCarpenterRelatedCache();
    return res.json({ message: 'Carpenter deleted successfully.' });
  } catch (error) {
    console.error('Delete carpenter error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}

export async function getCarpenterPayments(req, res) {
  const { id } = req.params;
  const { from, to } = req.query;

  try {
    const where = { carpenterId: id };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
    }

    const [carpenter, payments] = await Promise.all([
      prisma.carpenter.findUnique({ where: { id } }),
      prisma.carpenterPayment.findMany({
        where,
        orderBy: { date: 'desc' },
      }),
    ]);

    if (!carpenter) {
      return res.status(404).json({ error: 'Carpenter not found.' });
    }

    const summary = summarizeCarpenterTransactions(payments);
    return res.json({
      carpenter,
      payments,
      totalPaid: summary.totalPaid,
      totalCredit: summary.totalCredit,
      netBalance: summary.netBalance,
    });
  } catch (error) {
    console.error('Get carpenter payments error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getCarpenterLedger(req, res) {
  const { id } = req.params;
  const dateRange = parseLedgerDateRange(req.query);

  try {
    const [carpenter, payments] = await Promise.all([
      prisma.carpenter.findUnique({ where: { id } }),
      prisma.carpenterPayment.findMany({
        where: { carpenterId: id },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    if (!carpenter) {
      return res.status(404).json({ error: 'Carpenter not found.' });
    }

    const ledger = buildCarpenterLedgerEntries(payments, dateRange);

    return res.json({
      carpenter,
      ...ledger,
    });
  } catch (error) {
    console.error('Get carpenter ledger error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function addCarpenterPayment(req, res) {
  const { id } = req.params;
  const { amount, date, notes, transactionType = 'PAYMENT', customOrderNumber } = req.body;
  const paymentAmount = parseFloat(amount);
  const normalizedTransactionType = normalizeCarpenterTransactionType(transactionType);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Transaction amount must be greater than zero.' });
  }
  if (!CARPENTER_TRANSACTION_TYPES.has(normalizedTransactionType)) {
    return res.status(400).json({ error: 'Transaction type must be PAYMENT or CREDIT.' });
  }

  try {
    const carpenter = await prisma.carpenter.findUnique({ where: { id } });
    if (!carpenter) {
      return res.status(404).json({ error: 'Carpenter not found.' });
    }

    const payment = await prisma.carpenterPayment.create({
      data: {
        carpenterId: id,
        amount: paymentAmount,
        transactionType: normalizedTransactionType,
        date: date ? new Date(date) : new Date(),
        notes: notes?.trim() || null,
        customOrderNumber: customOrderNumber?.trim() || null,
      },
    });

    invalidateCarpenterRelatedCache();
    return res.status(201).json(payment);
  } catch (error) {
    console.error('Add carpenter payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}

export async function deleteCarpenterPayment(req, res) {
  const { id } = req.params;

  try {
    await prisma.carpenterPayment.delete({ where: { id } });
    invalidateCarpenterRelatedCache();
    return res.json({ message: 'Carpenter transaction deleted successfully.' });
  } catch (error) {
    console.error('Delete carpenter payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
