import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getExpenses(req, res) {
  const { expenseType, category, search, dateFrom, dateTo } = req.query;

  try {
    const where = {};
    const selectedType = expenseType || category;
    if (selectedType) {
      where.expenseType = selectedType;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      }
    }

    let expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      expenses = expenses.filter((exp) =>
        (exp.description && exp.description.toLowerCase().includes(q)) ||
        (exp.paidTo && exp.paidTo.toLowerCase().includes(q)) ||
        (exp.expenseType && exp.expenseType.toLowerCase().includes(q)) ||
        (exp.paymentMethod && exp.paymentMethod.toLowerCase().includes(q))
      );
    }

    const total = expenses.reduce((acc, exp) => acc + exp.amount, 0);

    return res.json({ expenses, total });
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createExpense(req, res) {
  const { date, expenseType, amount, paidTo, paymentMethod, description } = req.body;

  if (!expenseType || !amount || !paidTo || !paymentMethod) {
    return res.status(400).json({ error: 'Expense Type, Amount, Paid To, and Payment Method are required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Expense amount must be greater than zero.' });
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        date: date ? new Date(date) : new Date(),
        expenseType,
        amount: parsedAmount,
        paidTo,
        paymentMethod,
        description,
      },
    });

    return res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateExpense(req, res) {
  const { id } = req.params;
  const { date, expenseType, amount, paidTo, paymentMethod, description } = req.body;

  if (!expenseType || !amount || !paidTo || !paymentMethod) {
    return res.status(400).json({ error: 'Expense Type, Amount, Paid To, and Payment Method are required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Expense amount must be greater than zero.' });
  }

  try {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        date: date ? new Date(date) : new Date(),
        expenseType,
        amount: parsedAmount,
        paidTo,
        paymentMethod,
        description,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update expense error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteExpense(req, res) {
  const { id } = req.params;

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can delete expenses.' });
  }

  try {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    await prisma.expense.delete({ where: { id } });
    return res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
