import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { calculateCustomerBalanceAfter } from '../utils/ledger.js';

const prisma = new PrismaClient();

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseBooleanField(value) {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

export async function getInvoices(req, res) {
  const { search, paymentStatus, dateFrom, dateTo } = req.query;

  try {
    const where = {};

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
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

    let invoices = await prisma.invoice.findMany({
      where,
      include: { customer: true },
      orderBy: { date: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      invoices = invoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customer.name.toLowerCase().includes(q) ||
        inv.customer.phone.includes(q)
      );
    }

    return res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getInvoiceById(req, res) {
  const { id } = req.params;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true }
        },
        payments: true,
        deliveries: true,
        installments: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    return res.json(invoice);
  } catch (error) {
    console.error('Get invoice by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createInvoice(req, res) {
  const body = req.body || {};
  const {
    customerId,
    date,
    salesperson,
    discount, // invoice level discount
    deliveryCharge,
    installationCharge,
    otherCharge,
    paidAmount,
    paymentMethod,
    notes,
    createDelivery, // boolean
    driverName,
    vehicleNumber,
    deliveryDate,
    deliveryTime,
  } = body;
  const items = parseJsonField(body.items, []); // array of { productId, quantity, unitPrice, discount, warrantyPeriod }
  const installmentsList = parseJsonField(body.installmentsList, []); // array of { installmentAmount, dueDate }
  const shouldCreateDelivery = parseBooleanField(body.createDelivery);
  const furnitureImage = req.file ? `/uploads/${req.file.filename}` : null;

  // Validation rules
  if (!customerId) {
    return res.status(400).json({ error: 'Customer selection is required.' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Invoice must contain at least one item.' });
  }
  if (!paymentMethod) {
    return res.status(400).json({ error: 'Payment method is required.' });
  }

  const parsedDiscount = parseFloat(discount) || 0.0;
  const parsedDelCharge = parseFloat(deliveryCharge) || 0.0;
  const parsedInstCharge = parseFloat(installationCharge) || 0.0;
  const parsedOtherCharge = parseFloat(otherCharge) || 0.0;
  const parsedPaidAmount = parseFloat(paidAmount) || 0.0;

  if (parsedPaidAmount < 0) {
    return res.status(400).json({ error: 'Paid amount cannot be negative.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch customer and products to validate
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new Error('Selected customer does not exist.');
      }
      if (customer.status !== 'Active') {
        throw new Error('Selected customer is inactive.');
      }

      // Check credit customer condition
      const isCredit = parsedPaidAmount < (items.reduce((acc, it) => acc + (it.quantity * it.unitPrice - (it.discount || 0)), 0) - parsedDiscount + parsedDelCharge + parsedInstCharge + parsedOtherCharge);
      if (isCredit && customer.name.toLowerCase() === 'cash customer') {
        throw new Error('A registered customer is required for credit transactions.');
      }

      // 2. Perform Calculations
      let subtotal = 0;
      const invoiceItemsData = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        const itemDisc = parseFloat(item.discount) || 0.0;

        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantity must be greater than zero.');
        }
        if (isNaN(price) || price < 0) {
          throw new Error('Unit price cannot be negative.');
        }

        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.status !== 'Active') {
          throw new Error(`Product with SKU ${item.productCode || 'unknown'} is not active or does not exist.`);
        }

        // Check stock availability
        if (product.stockQty < qty && req.user.role !== 'ADMIN') {
          throw new Error(`Insufficient stock for product: ${product.name}. Available: ${product.stockQty}, Requested: ${qty}`);
        }

        const lineTotal = Number((qty * price - itemDisc).toFixed(2));
        subtotal += lineTotal;

        invoiceItemsData.push({
          productId: item.productId,
          productCode: product.code,
          productName: product.name,
          quantity: qty,
          unitPrice: price,
          discount: itemDisc,
          lineTotal,
          materialName: item.materialName || product.material || null,
          materialImage: item.materialImage || null,
          warrantyPeriod: item.warrantyPeriod || product.warrantyPeriod,
        });
      }

      const grandTotal = Number((subtotal - parsedDiscount + parsedDelCharge + parsedInstCharge + parsedOtherCharge).toFixed(2));
      const balanceAmount = Number((grandTotal - parsedPaidAmount).toFixed(2));

      let paymentStatus = 'CREDIT';
      if (parsedPaidAmount === grandTotal) {
        paymentStatus = 'PAID';
      } else if (parsedPaidAmount > 0 && parsedPaidAmount < grandTotal) {
        paymentStatus = 'PARTIAL';
      }

      // Generate invoice number
      const invoiceCount = await tx.invoice.count();
      const settings = await tx.businessSettings.findUnique({ where: { id: 'default' } });
      const prefix = settings ? settings.invoicePrefix : 'INV-';
      const invoiceNumber = `${prefix}${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

      // 3. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          date: date ? new Date(date) : new Date(),
          customerId,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          salesperson,
          subtotal,
          discount: parsedDiscount,
          deliveryCharge: parsedDelCharge,
          installationCharge: parsedInstCharge,
          otherCharge: parsedOtherCharge,
          grandTotal,
          paidAmount: parsedPaidAmount,
          balanceAmount,
          paymentMethod,
          paymentStatus,
          furnitureImage,
          notes,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      // 4. Update Product Stock and write StockMovement
      for (const item of invoice.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        const newStock = prod.stockQty - item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: newStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: 'SALE_OUT',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            quantityIn: 0,
            quantityOut: item.quantity,
            balanceAfter: newStock,
            description: `Sold in Invoice ${invoiceNumber}`,
          },
        });

        // 5. Generate warranty details if product has warranty period
        if (item.warrantyPeriod && item.warrantyPeriod.toLowerCase() !== 'no warranty' && item.warrantyPeriod.trim() !== '') {
          // Parse warranty period (e.g. "12 Months", "2 Years")
          let months = 12;
          const match = item.warrantyPeriod.match(/(\d+)\s*(Month|Year)/i);
          if (match) {
            const num = parseInt(match[1]);
            const type = match[2].toLowerCase();
            months = type.startsWith('year') ? num * 12 : num;
          }
          const endDate = new Date(invoice.date);
          endDate.setMonth(endDate.getMonth() + months);

          await tx.warranty.create({
            data: {
              invoiceItemId: item.id,
              productId: item.productId,
              customerId,
              startDate: invoice.date,
              endDate,
              period: item.warrantyPeriod,
              status: 'Active',
              notes: 'Generated automatically from purchase.',
            },
          });
        }
      }

      // 6. Customer Ledger entries
      // Debit grandTotal
      let currentCustomerBalance = customer.currentBalance;
      let balanceAfterInvoice = calculateCustomerBalanceAfter(currentCustomerBalance, grandTotal, 0);

      await tx.customerLedger.create({
        data: {
          customerId,
          date: invoice.date,
          transactionType: 'INVOICE',
          referenceNo: invoiceNumber,
          description: `Invoice Sale - ${invoiceNumber}`,
          debit: grandTotal,
          credit: 0,
          balanceAfter: balanceAfterInvoice,
        },
      });

      currentCustomerBalance = balanceAfterInvoice;

      // Credit paidAmount if paidAmount > 0
      if (parsedPaidAmount > 0) {
        let balanceAfterPayment = calculateCustomerBalanceAfter(currentCustomerBalance, 0, parsedPaidAmount);

        await tx.customerLedger.create({
          data: {
            customerId,
            date: invoice.date,
            transactionType: 'PAYMENT',
            referenceNo: invoiceNumber,
            description: `Invoice Payment received - ${invoiceNumber}`,
            debit: 0,
            credit: parsedPaidAmount,
            balanceAfter: balanceAfterPayment,
          },
        });

        // Create Payment record
        const paymentCount = await tx.payment.count();
        const paymentNo = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;
        await tx.payment.create({
          data: {
            paymentNumber: paymentNo,
            customerId,
            invoiceId: invoice.id,
            date: invoice.date,
            amount: parsedPaidAmount,
            paymentMethod,
            notes: `Cash/Card payment on Invoice ${invoiceNumber}`,
          },
        });

        currentCustomerBalance = balanceAfterPayment;
      }

      // Update customer balance in database
      await tx.customer.update({
        where: { id: customerId },
        data: { currentBalance: currentCustomerBalance },
      });

      // 7. Deliveries
      if (shouldCreateDelivery || parsedDelCharge > 0) {
        const deliveryCount = await tx.delivery.count();
        const deliveryNumber = `DEL-${new Date().getFullYear()}-${String(deliveryCount + 1).padStart(4, '0')}`;

        await tx.delivery.create({
          data: {
            deliveryNumber,
            invoiceId: invoice.id,
            customerName: customer.name,
            phone: customer.phone,
            address: customer.address,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
            deliveryTime: deliveryTime || 'Standard Time',
            driverName: driverName || '',
            vehicleNumber: vehicleNumber || '',
            deliveryCharge: parsedDelCharge,
            deliveryStatus: driverName ? 'Scheduled' : 'Pending',
            notes: notes || 'Delivery from invoice creation.',
          },
        });
      }

      // 8. Installments schedule
      if (installmentsList && installmentsList.length > 0) {
        for (const inst of installmentsList) {
          await tx.installment.create({
            data: {
              customerId,
              invoiceId: invoice.id,
              totalBalance: balanceAmount,
              installmentAmount: parseFloat(inst.installmentAmount),
              dueDate: new Date(inst.dueDate),
              status: 'Pending',
            },
          });
        }
      }

      return invoice;
    });

    return res.status(201).json(result);
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('Create invoice error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function addInvoicePayment(req, res) {
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
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { customer: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found.');
      }
      if (invoice.paymentStatus === 'PAID') {
        throw new Error('This invoice is already fully paid.');
      }
      if (invoice.paymentStatus === 'CANCELLED') {
        throw new Error('Cannot add payment to a cancelled invoice.');
      }

      const newPaid = Number((invoice.paidAmount + paymentAmt).toFixed(2));
      const newBalance = Number((invoice.grandTotal - newPaid).toFixed(2));

      if (newBalance < 0) {
        throw new Error(`Payment amount exceeds outstanding balance. Balance: ${invoice.balanceAmount}`);
      }

      let paymentStatus = 'PARTIAL';
      if (newBalance === 0) {
        paymentStatus = 'PAID';
      }

      // Update Invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus,
        },
      });

      // Customer payment record
      const paymentCount = await tx.payment.count();
      const paymentNo = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;
      await tx.payment.create({
        data: {
          paymentNumber: paymentNo,
          customerId: invoice.customerId,
          invoiceId: id,
          date: date ? new Date(date) : new Date(),
          amount: paymentAmt,
          paymentMethod,
          referenceNumber,
          notes,
        },
      });

      // Update customer ledger: credit the payment
      const balanceAfter = calculateCustomerBalanceAfter(invoice.customer.currentBalance, 0, paymentAmt);

      await tx.customerLedger.create({
        data: {
          customerId: invoice.customerId,
          date: date ? new Date(date) : new Date(),
          transactionType: 'PAYMENT',
          referenceNo: invoice.invoiceNumber,
          description: `Payment received on Invoice ${invoice.invoiceNumber}`,
          debit: 0,
          credit: paymentAmt,
          balanceAfter,
        },
      });

      // Update customer current balance
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { currentBalance: balanceAfter },
      });

      return updatedInvoice;
    });

    return res.json(result);
  } catch (error) {
    console.error('Invoice payment error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function cancelInvoice(req, res) {
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: true,
          payments: true
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found.');
      }
      if (invoice.paymentStatus === 'CANCELLED') {
        throw new Error('This invoice is already cancelled.');
      }

      // Check if it's already paid, if so, only admin can cancel
      if (invoice.paymentStatus === 'PAID' && req.user.role !== 'ADMIN') {
        throw new Error('Only administrator role is authorized to cancel fully paid invoices.');
      }

      // 1. Cancel Invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { paymentStatus: 'CANCELLED' },
      });

      // 2. Restore stock for each item & add RETURN_IN stock movement
      for (const item of invoice.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        const restoredStock = prod.stockQty + item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: restoredStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: 'RETURN_IN',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            quantityIn: item.quantity,
            quantityOut: 0,
            balanceAfter: restoredStock,
            description: `Returned - Cancelled Invoice ${invoice.invoiceNumber}`,
          },
        });
      }

      // 3. Reverse customer ledger balances
      // Create a credit entry to reverse the original grandTotal debit
      let currentBalance = invoice.customer.currentBalance;
      let balanceAfterReverseInvoice = calculateCustomerBalanceAfter(currentBalance, 0, invoice.grandTotal);

      await tx.customerLedger.create({
        data: {
          customerId: invoice.customerId,
          transactionType: 'ADJUSTMENT',
          referenceNo: invoice.invoiceNumber,
          description: `Cancelled Invoice Reversal - ${invoice.invoiceNumber}`,
          debit: 0,
          credit: invoice.grandTotal,
          balanceAfter: balanceAfterReverseInvoice,
        },
      });

      currentBalance = balanceAfterReverseInvoice;

      // If they paid anything, we must debit that back in the ledger (as we would refund it or restore credit)
      if (invoice.paidAmount > 0) {
        let balanceAfterReversePayment = calculateCustomerBalanceAfter(currentBalance, invoice.paidAmount, 0);

        await tx.customerLedger.create({
          data: {
            customerId: invoice.customerId,
            transactionType: 'ADJUSTMENT',
            referenceNo: invoice.invoiceNumber,
            description: `Cancelled Invoice Payment Reversal - ${invoice.invoiceNumber}`,
            debit: invoice.paidAmount,
            credit: 0,
            balanceAfter: balanceAfterReversePayment,
          },
        });

        currentBalance = balanceAfterReversePayment;
      }

      // Update customer balance in DB
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { currentBalance },
      });

      // 4. Cancel related deliveries
      await tx.delivery.updateMany({
        where: { invoiceId: id },
        data: { deliveryStatus: 'Failed', notes: 'Delivery cancelled: Invoice cancelled.' },
      });

      // 5. Cancel related installments
      await tx.installment.updateMany({
        where: { invoiceId: id },
        data: { status: 'Overdue' }, // or delete
      });

      return updatedInvoice;
    });

    return res.json({ message: 'Invoice cancelled successfully.', invoice: result });
  } catch (error) {
    console.error('Cancel invoice error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function deleteInvoice(req, res) {
  const { id } = req.params;

  // Invoice deletion is only permitted for Cancelled or Draft invoices, and requires Admin
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can delete invoices.' });
  }

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    if (invoice.paymentStatus !== 'CANCELLED') {
      return res.status(400).json({ error: 'Only cancelled invoices can be deleted. Cancel the invoice first.' });
    }

    await prisma.invoice.delete({ where: { id } });
    return res.json({ message: 'Invoice deleted from records.' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getInvoicePrintDetails(req, res) {
  const { id } = req.params;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        deliveries: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const businessSettings = await prisma.businessSettings.findUnique({ where: { id: 'default' } });
    const receiptSettings = await prisma.receiptSettings.findUnique({ where: { id: 'default' } });

    return res.json({
      invoice,
      business: businessSettings,
      receipt: receiptSettings
    });
  } catch (error) {
    console.error('Get invoice print error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
