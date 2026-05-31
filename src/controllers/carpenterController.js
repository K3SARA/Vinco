import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CARPENTER_TRANSACTION_TYPES = new Set(['PAYMENT', 'CREDIT']);

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

    return res.json(carpenters.map((carpenter) => ({
      ...carpenter,
      accountSummary: summariesByCarpenter.get(carpenter.id) || getEmptyCarpenterAccountSummary(),
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
      return res.json({ message: 'Carpenter has payment history and was marked inactive.', carpenter });
    }

    await prisma.carpenter.delete({ where: { id } });
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

export async function addCarpenterPayment(req, res) {
  const { id } = req.params;
  const { amount, date, notes, transactionType = 'PAYMENT' } = req.body;
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
      },
    });

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
    return res.json({ message: 'Carpenter transaction deleted successfully.' });
  } catch (error) {
    console.error('Delete carpenter payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
