import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
          orderBy: { date: 'desc' },
          take: 1,
        },
        _count: {
          select: { payments: true },
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return res.json(carpenters);
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

    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return res.json({ carpenter, payments, totalPaid });
  } catch (error) {
    console.error('Get carpenter payments error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function addCarpenterPayment(req, res) {
  const { id } = req.params;
  const { amount, date, notes } = req.body;
  const paymentAmount = parseFloat(amount);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
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
    return res.json({ message: 'Carpenter payment deleted successfully.' });
  } catch (error) {
    console.error('Delete carpenter payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
