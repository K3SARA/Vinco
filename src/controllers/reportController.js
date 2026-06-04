import prisma from '../utils/prisma.js';
import { getOrSetCache } from '../utils/cache.js';

// Helper to get start and end of today
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Helper to get start and end of current month
function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function summarizeCarpenterTransactions(payments = []) {
  const summary = {
    totalPaid: 0,
    totalCredit: 0,
    netExpense: 0,
  };

  for (const payment of payments) {
    const amount = Number(payment.amount || 0);
    if (payment.transactionType === 'CREDIT') {
      summary.totalCredit += amount;
    } else {
      summary.totalPaid += amount;
    }
  }

  summary.netExpense = summary.totalPaid - summary.totalCredit;
  return summary;
}

function selectDashboardStatsForRole(stats, role) {
  if (role === 'ADMIN') {
    return stats;
  }

  const fieldsByRole = {
    CASHIER: [
      'todaySales',
      'todayCashReceived',
      'todayCardBankReceived',
      'pendingOrdersCount',
      'pendingDeliveriesCount',
      'pendingCustomerPayments',
      'lowStockCount',
      'monthlyCarpenterPayments',
      'monthlyCarpenterCredits',
      'monthlyCarpenterNetExpense',
      'totalReceivables',
    ],
    SALESPERSON: [
      'pendingOrdersCount',
      'pendingCustomerPayments',
      'lowStockCount',
      'totalReceivables',
    ],
    DELIVERY_STAFF: [
      'pendingDeliveriesCount',
    ],
  };

  const selected = {};
  for (const field of fieldsByRole[role] || []) {
    selected[field] = stats[field];
  }
  return selected;
}

export async function getDashboardStats(req, res) {
  try {
    const stats = await getOrSetCache('dashboard:stats', async () => {
      const today = getTodayRange();
      const month = getMonthRange();

      const [
        todayInvoiceTotals,
        paymentMethodGroups,
        pendingOrdersCount,
        pendingDeliveriesCount,
        pendingPaymentTotals,
        stockTotalsRows,
        monthlyInvoiceTotals,
        monthlyCogsRows,
        monthlyExpenseTotals,
        carpenterPaymentGroups,
        customerBalanceTotals,
        supplierBalanceTotals,
      ] = await Promise.all([
        prisma.invoice.aggregate({
          where: {
            date: { gte: today.start, lte: today.end },
            paymentStatus: { not: 'CANCELLED' },
          },
          _sum: { grandTotal: true },
        }),
        prisma.payment.groupBy({
          by: ['paymentMethod'],
          where: { date: { gte: today.start, lte: today.end } },
          _sum: { amount: true },
        }),
        prisma.order.count({
          where: { orderStatus: { in: ['Pending', 'In Progress', 'Ready'] } },
        }),
        prisma.delivery.count({
          where: { deliveryStatus: { in: ['Pending', 'Scheduled', 'Out For Delivery', 'Rescheduled'] } },
        }),
        prisma.invoice.aggregate({
          where: { paymentStatus: { in: ['CREDIT', 'PARTIAL'] } },
          _sum: { balanceAmount: true },
        }),
        prisma.$queryRaw`
          SELECT
            COUNT(*) FILTER (WHERE "stockQty" <= "minStockAlert")::int AS "lowStockCount",
            COALESCE(SUM("stockQty" * "costPrice"), 0)::float AS "totalStockValue"
          FROM "Product"
          WHERE "status" = 'Active'
        `,
        prisma.invoice.aggregate({
          where: {
            date: { gte: month.start, lte: month.end },
            paymentStatus: { not: 'CANCELLED' },
          },
          _sum: { grandTotal: true },
        }),
        prisma.$queryRaw`
          SELECT COALESCE(SUM(ii."quantity" * p."costPrice"), 0)::float AS "monthlyCOGS"
          FROM "InvoiceItem" ii
          INNER JOIN "Invoice" i ON i."id" = ii."invoiceId"
          INNER JOIN "Product" p ON p."id" = ii."productId"
          WHERE i."date" >= ${month.start}
            AND i."date" <= ${month.end}
            AND i."paymentStatus" <> 'CANCELLED'
        `,
        prisma.expense.aggregate({
          where: { date: { gte: month.start, lte: month.end } },
          _sum: { amount: true },
        }),
        prisma.carpenterPayment.groupBy({
          by: ['transactionType'],
          where: { date: { gte: month.start, lte: month.end } },
          _sum: { amount: true },
        }),
        prisma.customer.aggregate({
          where: { currentBalance: { gt: 0 } },
          _sum: { currentBalance: true },
        }),
        prisma.supplier.aggregate({
          where: { currentBalance: { gt: 0 } },
          _sum: { currentBalance: true },
        }),
      ]);

      const sum = (value) => Number(value || 0);
      const todaySales = sum(todayInvoiceTotals._sum.grandTotal);
      const pendingCustomerPayments = sum(pendingPaymentTotals._sum.balanceAmount);
      const stockTotals = stockTotalsRows[0] || {};
      const lowStockCount = sum(stockTotals.lowStockCount);
      const totalStockValue = sum(stockTotals.totalStockValue);
      const monthlySales = sum(monthlyInvoiceTotals._sum.grandTotal);
      const monthlyCOGS = sum(monthlyCogsRows[0]?.monthlyCOGS);
      const shopExpensesTotal = sum(monthlyExpenseTotals._sum.amount);
      const totalReceivables = sum(customerBalanceTotals._sum.currentBalance);
      const totalPayables = sum(supplierBalanceTotals._sum.currentBalance);

      let todayCashReceived = 0;
      let todayCardBankReceived = 0;
      for (const paymentGroup of paymentMethodGroups) {
        const method = paymentGroup.paymentMethod.toLowerCase();
        const amount = sum(paymentGroup._sum.amount);
        if (method === 'cash') {
          todayCashReceived += amount;
        } else if (method === 'card' || method.includes('bank') || method.includes('transfer') || method === 'online') {
          todayCardBankReceived += amount;
        }
      }

      const carpenterSummary = summarizeCarpenterTransactions(
        carpenterPaymentGroups.map((group) => ({
          transactionType: group.transactionType,
          amount: sum(group._sum.amount),
        }))
      );
      const totalExpenses = shopExpensesTotal + carpenterSummary.netExpense;
      const monthlyProfitLoss = monthlySales - monthlyCOGS - totalExpenses;

      return {
        todaySales,
        todayCashReceived,
        todayCardBankReceived,
        pendingOrdersCount,
        pendingDeliveriesCount,
        pendingCustomerPayments,
        lowStockCount,
        totalStockValue,
        monthlySales,
        monthlyProfitLoss,
        monthlyCarpenterPayments: carpenterSummary.totalPaid,
        monthlyCarpenterCredits: carpenterSummary.totalCredit,
        monthlyCarpenterNetExpense: carpenterSummary.netExpense,
        totalReceivables,
        totalPayables
      };
    }, 15_000);

    return res.json(selectDashboardStatsForRole(stats, req.user.role));
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 1. Daily Sales Report
export async function getDailySalesReport(req, res) {
  const { dateFrom, dateTo } = req.query;
  try {
    const where = { paymentStatus: { not: 'CANCELLED' } };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: { include: { product: true } }
      },
      orderBy: { date: 'asc' }
    });

    // Group by Date
    const grouped = {};
    for (const inv of invoices) {
      const dateString = inv.date.toISOString().split('T')[0];
      if (!grouped[dateString]) {
        grouped[dateString] = {
          date: dateString,
          invoiceCount: 0,
          totalSales: 0,
          cashReceived: 0,
          cardBankReceived: 0,
          creditSales: 0,
          discountTotal: 0,
          costOfGoods: 0,
        };
      }

      grouped[dateString].invoiceCount += 1;
      grouped[dateString].totalSales += inv.grandTotal;
      grouped[dateString].discountTotal += inv.discount;

      if (inv.paymentMethod.toLowerCase() === 'cash') {
        grouped[dateString].cashReceived += inv.paidAmount;
      } else {
        grouped[dateString].cardBankReceived += inv.paidAmount;
      }

      grouped[dateString].creditSales += inv.balanceAmount;

      // Estimate Cost of Goods Sold
      for (const item of inv.items) {
        const cost = item.product ? item.product.costPrice : 0;
        grouped[dateString].costOfGoods += item.quantity * cost;
      }
    }

    const reportData = Object.values(grouped).map(day => ({
      ...day,
      profitEstimate: day.totalSales - day.costOfGoods
    }));

    return res.json(reportData);
  } catch (error) {
    console.error('Daily sales report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 2. Monthly Sales Report
export async function getMonthlySalesReport(req, res) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { paymentStatus: { not: 'CANCELLED' } },
      include: { items: { include: { product: true } } },
      orderBy: { date: 'asc' }
    });

    const grouped = {};
    for (const inv of invoices) {
      const year = inv.date.getFullYear();
      const month = String(inv.date.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          month: monthKey,
          salesTotal: 0,
          paymentReceived: 0,
          creditBalance: 0,
          cogs: 0,
        };
      }

      grouped[monthKey].salesTotal += inv.grandTotal;
      grouped[monthKey].paymentReceived += inv.paidAmount;
      grouped[monthKey].creditBalance += inv.balanceAmount;

      for (const item of inv.items) {
        const cost = item.product ? item.product.costPrice : 0;
        grouped[monthKey].cogs += item.quantity * cost;
      }
    }

    // Include expenses per month
    const expenses = await prisma.expense.findMany();
    const expensesGrouped = {};
    for (const exp of expenses) {
      const year = exp.date.getFullYear();
      const month = String(exp.date.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      if (!expensesGrouped[monthKey]) {
        expensesGrouped[monthKey] = 0;
      }
      expensesGrouped[monthKey] += exp.amount;
    }

    const carpenterPayments = await prisma.carpenterPayment.findMany();
    const carpenterGrouped = {};
    for (const payment of carpenterPayments) {
      const year = payment.date.getFullYear();
      const month = String(payment.date.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      if (!carpenterGrouped[monthKey]) {
        carpenterGrouped[monthKey] = { totalPaid: 0, totalCredit: 0, netExpense: 0 };
      }

      if (payment.transactionType === 'CREDIT') {
        carpenterGrouped[monthKey].totalCredit += payment.amount;
      } else {
        carpenterGrouped[monthKey].totalPaid += payment.amount;
      }
      carpenterGrouped[monthKey].netExpense = carpenterGrouped[monthKey].totalPaid - carpenterGrouped[monthKey].totalCredit;
    }

    const reportData = Object.values(grouped).map(m => {
      const shopExpense = expensesGrouped[m.month] || 0;
      const carpenterNetExpense = carpenterGrouped[m.month]?.netExpense || 0;
      const monthlyExpense = shopExpense + carpenterNetExpense;
      return {
        ...m,
        shopExpenses: shopExpense,
        carpenterNetExpense,
        expenses: monthlyExpense,
        profitLoss: m.salesTotal - m.cogs - monthlyExpense
      };
    });

    return res.json(reportData);
  } catch (error) {
    console.error('Monthly sales report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 3. Stock Report
export async function getStockReport(req, res) {
  const { categoryId, lowStock } = req.query;

  try {
    const where = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        invoiceItems: {
          where: { invoice: { paymentStatus: { not: 'CANCELLED' } } }
        },
        purchaseItems: {
          where: { purchase: { paymentStatus: { not: 'CANCELLED' } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    let reportData = products.map(p => {
      const soldQty = p.invoiceItems.reduce((acc, it) => acc + it.quantity, 0);
      const purchasedQty = p.purchaseItems.reduce((acc, it) => acc + it.quantity, 0);
      // Opening stock can be calculated: current + sold - purchased
      const openingStock = p.stockQty + soldQty - purchasedQty;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category.name,
        openingStock,
        purchasedQuantity: purchasedQty,
        soldQuantity: soldQty,
        currentStock: p.stockQty,
        stockValue: p.stockQty * p.costPrice,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        minStockAlert: p.minStockAlert,
        isLowStock: p.stockQty <= p.minStockAlert
      };
    });

    if (lowStock === 'true') {
      reportData = reportData.filter(p => p.isLowStock);
    }

    return res.json(reportData);
  } catch (error) {
    console.error('Stock report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 4. Customer Balances Report
export async function getCustomerBalancesReport(req, res) {
  const { debtOnly } = req.query;
  try {
    const where = {};
    if (debtOnly === 'true') {
      where.currentBalance = { gt: 0 };
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        invoices: { where: { paymentStatus: { not: 'CANCELLED' } } }
      },
      orderBy: { currentBalance: 'desc' }
    });

    const reportData = customers.map(c => {
      const totalInvoiced = c.invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
      const totalPaid = c.invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalInvoices: c.invoices.length,
        totalInvoiced,
        totalPaid,
        receivableBalance: c.currentBalance,
        status: c.status
      };
    });

    return res.json(reportData);
  } catch (error) {
    console.error('Customer balance report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 5. Supplier Balances Report
export async function getSupplierBalancesReport(req, res) {
  const { payableOnly } = req.query;
  try {
    const where = {};
    if (payableOnly === 'true') {
      where.currentBalance = { gt: 0 };
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: { purchases: true },
      orderBy: { currentBalance: 'desc' }
    });

    const reportData = suppliers.map(s => {
      const totalPurchased = s.purchases.reduce((acc, p) => acc + p.grandTotal, 0);
      const totalPaid = s.purchases.reduce((acc, p) => acc + p.paidAmount, 0);
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        totalPurchases: s.purchases.length,
        totalPurchased,
        totalPaid,
        payableBalance: s.currentBalance,
        status: s.status
      };
    });

    return res.json(reportData);
  } catch (error) {
    console.error('Supplier balances report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 6. Delivery Report
export async function getDeliveryReport(req, res) {
  const { status, driver } = req.query;
  try {
    const where = {};
    if (status) where.deliveryStatus = status;
    if (driver) where.driverName = driver;

    const deliveries = await prisma.delivery.findMany({
      where,
      include: { invoice: true, order: true },
      orderBy: { deliveryDate: 'desc' }
    });

    return res.json(deliveries);
  } catch (error) {
    console.error('Delivery report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 7. Profit/Loss Report
export async function getProfitLossReport(req, res) {
  const { dateFrom, dateTo } = req.query;

  try {
    const invoiceWhere = { paymentStatus: { not: 'CANCELLED' } };
    const expenseWhere = {};
    const carpenterPaymentWhere = {};

    if (dateFrom || dateTo) {
      invoiceWhere.date = {};
      expenseWhere.date = {};
      carpenterPaymentWhere.date = {};

      if (dateFrom) {
        invoiceWhere.date.gte = new Date(dateFrom);
        expenseWhere.date.gte = new Date(dateFrom);
        carpenterPaymentWhere.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        invoiceWhere.date.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
        expenseWhere.date.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
        carpenterPaymentWhere.date.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: { items: { include: { product: true } } }
    });

    const expensesList = await prisma.expense.findMany({
      where: expenseWhere
    });
    const carpenterPayments = await prisma.carpenterPayment.findMany({
      where: carpenterPaymentWhere
    });

    const salesTotal = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);

    let costOfGoodsSold = 0;
    for (const inv of invoices) {
      for (const item of inv.items) {
        const cost = item.product ? item.product.costPrice : 0;
        costOfGoodsSold += item.quantity * cost;
      }
    }

    const shopExpensesTotal = expensesList.reduce((acc, exp) => acc + exp.amount, 0);
    const carpenterSummary = summarizeCarpenterTransactions(carpenterPayments);
    const totalExpenses = shopExpensesTotal + carpenterSummary.netExpense;

    const grossProfit = salesTotal - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    // Group expenses by type for details
    const expensesByType = {};
    for (const exp of expensesList) {
      if (!expensesByType[exp.expenseType]) {
        expensesByType[exp.expenseType] = 0;
      }
      expensesByType[exp.expenseType] += exp.amount;
    }
    if (carpenterSummary.netExpense !== 0) {
      expensesByType.CARPENTER_PAYMENTS = carpenterSummary.netExpense;
    }

    return res.json({
      salesTotal,
      costOfGoodsSold,
      grossProfit,
      expensesTotal: totalExpenses,
      shopExpensesTotal,
      carpenterPaymentsTotal: carpenterSummary.totalPaid,
      carpenterCreditsTotal: carpenterSummary.totalCredit,
      carpenterNetExpense: carpenterSummary.netExpense,
      expensesByType,
      netProfit,
    });
  } catch (error) {
    console.error('Profit/Loss report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 8. Best Selling Furniture Report
export async function getBestSellingReport(req, res) {
  try {
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { invoice: { paymentStatus: { not: 'CANCELLED' } } },
      include: { product: true }
    });

    const grouped = {};
    for (const item of invoiceItems) {
      const pid = item.productId;
      if (!grouped[pid]) {
        grouped[pid] = {
          id: pid,
          code: item.productCode,
          name: item.productName,
          category: item.product ? item.product.categoryId : 'Other', // resolve category name later
          quantitySold: 0,
          revenue: 0,
          cost: 0,
        };
      }

      grouped[pid].quantitySold += item.quantity;
      grouped[pid].revenue += item.lineTotal;
      const costPrice = item.product ? item.product.costPrice : 0;
      grouped[pid].cost += item.quantity * costPrice;
    }

    // Resolve Category Name
    const categories = await prisma.category.findMany();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    const reportData = Object.values(grouped).map(item => {
      const resolvedCategory = catMap[item.category] || 'Other';
      return {
        ...item,
        category: resolvedCategory,
        profit: item.revenue - item.cost
      };
    }).sort((a, b) => b.quantitySold - a.quantitySold); // Sort by quantity sold

    return res.json(reportData);
  } catch (error) {
    console.error('Best selling report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// 9. Pending Payment Report
export async function getPendingPaymentsReport(req, res) {
  try {
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: { in: ['CREDIT', 'PARTIAL'] }
      },
      include: { customer: true },
      orderBy: { date: 'asc' }
    });

    const reportData = overdueInvoices.map(inv => {
      const diffTime = Math.abs(new Date() - new Date(inv.date));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.name,
        phone: inv.customer.phone,
        grandTotal: inv.grandTotal,
        paidAmount: inv.paidAmount,
        dueAmount: inv.balanceAmount,
        daysOverdue: diffDays,
        date: inv.date
      };
    });

    return res.json(reportData);
  } catch (error) {
    console.error('Pending payments report error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
