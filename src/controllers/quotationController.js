import { PrismaClient } from '@prisma/client';
import { calculateCustomerBalanceAfter } from '../utils/ledger.js';
import { getNextDocumentNumber } from '../utils/documentNumbers.js';
import { invalidateCache } from '../utils/cache.js';

const prisma = new PrismaClient();

function invalidateQuotationConversionCache() {
  invalidateCache(['dashboard:', 'customers:', 'products:', 'invoices:']);
}

export async function getQuotations(req, res) {
  const { search, status } = req.query;

  try {
    const where = {};
    if (status) {
      where.status = status;
    }

    let quotations = await prisma.quotation.findMany({
      where,
      include: { customer: true },
      orderBy: { date: 'desc' },
    });

    // Check expiration and dynamically mark as Expired if status is Sent/Draft and validUntil < now
    const now = new Date();
    quotations = quotations.map(q => {
      if ((q.status === 'Sent' || q.status === 'Draft') && new Date(q.validUntil) < now) {
        return { ...q, status: 'Expired' };
      }
      return q;
    });

    if (search) {
      const q = search.toLowerCase();
      quotations = quotations.filter(qtn => 
        qtn.quotationNumber.toLowerCase().includes(q) ||
        qtn.customer.name.toLowerCase().includes(q) ||
        qtn.customer.phone.includes(q)
      );
    }

    return res.json(quotations);
  } catch (error) {
    console.error('Get quotations error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getQuotationById(req, res) {
  const { id } = req.params;
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    // Check expiry
    const isExpired = (quotation.status === 'Sent' || quotation.status === 'Draft') && new Date(quotation.validUntil) < new Date();
    const finalQuotation = isExpired ? { ...quotation, status: 'Expired' } : quotation;

    const businessSettings = await prisma.businessSettings.findUnique({ where: { id: 'default' } });
    const receiptSettings = await prisma.receiptSettings.findUnique({ where: { id: 'default' } });

    return res.json({
      quotation: finalQuotation,
      business: businessSettings,
      receipt: receiptSettings
    });
  } catch (error) {
    console.error('Get quotation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createQuotation(req, res) {
  const {
    customerId,
    date,
    items,
    discount,
    deliveryCharge,
    installationCharge,
    validUntil,
    notes,
    status
  } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'Customer is required.' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Quotation must contain at least one item.' });
  }
  if (!validUntil) {
    return res.status(400).json({ error: 'Validity date is required.' });
  }

  const parsedDiscount = parseFloat(discount) || 0.0;
  const parsedDelCharge = parseFloat(deliveryCharge) || 0.0;
  const parsedInstCharge = parseFloat(installationCharge) || 0.0;

  if (parsedDiscount < 0 || parsedDelCharge < 0 || parsedInstCharge < 0) {
    return res.status(400).json({ error: 'Discounts and charges cannot be negative.' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(400).json({ error: 'Selected customer does not exist.' });
    }

    let subtotal = 0;
    const quotationItemsData = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const itemDisc = parseFloat(item.discount) || 0.0;

      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than zero.' });
      }
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Unit price cannot be negative.' });
      }
      if (itemDisc < 0) {
        return res.status(400).json({ error: 'Item discount cannot be negative.' });
      }

      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        return res.status(400).json({ error: `Product not found.` });
      }

      const grossLineTotal = Number((qty * price).toFixed(2));
      if (itemDisc > grossLineTotal) {
        return res.status(400).json({ error: `Item discount cannot exceed line total for ${product.name}.` });
      }

      const lineTotal = Number((grossLineTotal - itemDisc).toFixed(2));
      subtotal += lineTotal;

      quotationItemsData.push({
        productId: item.productId,
        productCode: product.code,
        productName: product.name,
        quantity: qty,
        unitPrice: price,
        discount: itemDisc,
        lineTotal,
      });
    }

    const totalAmount = Number((subtotal - parsedDiscount + parsedDelCharge + parsedInstCharge).toFixed(2));
    if (parsedDiscount > subtotal + parsedDelCharge + parsedInstCharge) {
      return res.status(400).json({ error: 'Quotation discount cannot exceed the quotation total.' });
    }

    const settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } });
    const prefix = settings ? settings.quotationPrefix : 'QTN-';

    const quotation = await prisma.$transaction(async (tx) => {
      const quotationNumber = await getNextDocumentNumber(tx, {
        counterName: 'quotation',
        prefix,
        modelName: 'quotation',
        fieldName: 'quotationNumber',
      });

      return tx.quotation.create({
        data: {
          quotationNumber,
          date: date ? new Date(date) : new Date(),
          customerId,
          subtotal,
          discount: parsedDiscount,
          deliveryCharge: parsedDelCharge,
          installationCharge: parsedInstCharge,
          totalAmount,
          validUntil: new Date(validUntil),
          notes,
          status: status || 'Sent',
          items: {
            create: quotationItemsData,
          },
        },
        include: {
          items: true,
        },
      });
    });

    return res.status(201).json(quotation);
  } catch (error) {
    console.error('Create quotation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateQuotation(req, res) {
  const { id } = req.params;
  const {
    customerId,
    date,
    items,
    discount,
    deliveryCharge,
    installationCharge,
    validUntil,
    notes,
    status
  } = req.body;

  if (!customerId || !items || items.length === 0 || !validUntil) {
    return res.status(400).json({ error: 'Customer, items, and valid date are required.' });
  }

  const parsedDiscount = parseFloat(discount) || 0.0;
  const parsedDelCharge = parseFloat(deliveryCharge) || 0.0;
  const parsedInstCharge = parseFloat(installationCharge) || 0.0;

  if (parsedDiscount < 0 || parsedDelCharge < 0 || parsedInstCharge < 0) {
    return res.status(400).json({ error: 'Discounts and charges cannot be negative.' });
  }

  try {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }
    if (existing.status === 'Converted') {
      return res.status(400).json({ error: 'Cannot edit a converted quotation.' });
    }

    let subtotal = 0;
    const itemsData = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const itemDisc = parseFloat(item.discount) || 0.0;

      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than zero.' });
      }
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Unit price cannot be negative.' });
      }
      if (itemDisc < 0) {
        return res.status(400).json({ error: 'Item discount cannot be negative.' });
      }
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        return res.status(400).json({ error: 'Product not found.' });
      }
      const grossLineTotal = Number((qty * price).toFixed(2));
      if (itemDisc > grossLineTotal) {
        return res.status(400).json({ error: `Item discount cannot exceed line total for ${product.name}.` });
      }

      const lineTotal = Number((grossLineTotal - itemDisc).toFixed(2));
      subtotal += lineTotal;

      itemsData.push({
        productId: item.productId,
        productCode: product.code,
        productName: product.name,
        quantity: qty,
        unitPrice: price,
        discount: itemDisc,
        lineTotal,
      });
    }

    const totalAmount = Number((subtotal - parsedDiscount + parsedDelCharge + parsedInstCharge).toFixed(2));
    if (parsedDiscount > subtotal + parsedDelCharge + parsedInstCharge) {
      return res.status(400).json({ error: 'Quotation discount cannot exceed the quotation total.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      return await tx.quotation.update({
        where: { id },
        data: {
          customerId,
          date: date ? new Date(date) : new Date(),
          subtotal,
          discount: parsedDiscount,
          deliveryCharge: parsedDelCharge,
          installationCharge: parsedInstCharge,
          totalAmount,
          validUntil: new Date(validUntil),
          notes,
          status: status || 'Sent',
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
        },
      });
    });

    return res.json(result);
  } catch (error) {
    console.error('Update quotation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteQuotation(req, res) {
  const { id } = req.params;
  try {
    const qtn = await prisma.quotation.findUnique({ where: { id } });
    if (!qtn) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    await prisma.quotation.delete({ where: { id } });
    return res.json({ message: 'Quotation deleted successfully.' });
  } catch (error) {
    console.error('Delete quotation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function convertToInvoice(req, res) {
  const { id } = req.params;
  const { paymentMethod, paidAmount, salesperson, notes } = req.body;

  if (!paymentMethod) {
    return res.status(400).json({ error: 'Payment method is required to generate invoice.' });
  }

  const parsedPaidAmount = parseFloat(paidAmount) || 0.0;
  if (parsedPaidAmount < 0) {
    return res.status(400).json({ error: 'Paid amount cannot be negative.' });
  }

  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }
    if (quotation.status === 'Converted') {
      return res.status(400).json({ error: 'This quotation has already been converted.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark quotation as Converted
      const converted = await tx.quotation.updateMany({
        where: {
          id,
          status: { not: 'Converted' },
        },
        data: { status: 'Converted' },
      });
      if (converted.count !== 1) {
        throw new Error('This quotation has already been converted.');
      }

      // 2. Generate Invoice number
      const settings = await tx.businessSettings.findUnique({ where: { id: 'default' } });
      const prefix = settings ? settings.invoicePrefix : 'INV-';
      const invoiceNumber = await getNextDocumentNumber(tx, {
        counterName: 'invoice',
        prefix,
        modelName: 'invoice',
        fieldName: 'invoiceNumber',
      });

      const grandTotal = quotation.totalAmount;
      const balanceAmount = Number((grandTotal - parsedPaidAmount).toFixed(2));
      if (parsedPaidAmount > grandTotal) {
        throw new Error(`Paid amount cannot exceed invoice total. Invoice total: ${grandTotal}`);
      }

      let paymentStatus = 'CREDIT';
      if (parsedPaidAmount === grandTotal) {
        paymentStatus = 'PAID';
      } else if (parsedPaidAmount > 0 && parsedPaidAmount < grandTotal) {
        paymentStatus = 'PARTIAL';
      }

      // 3. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          date: new Date(),
          customerId: quotation.customerId,
          customerPhone: quotation.customer.phone,
          customerAddress: quotation.customer.address,
          salesperson: salesperson || '',
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          deliveryCharge: quotation.deliveryCharge,
          installationCharge: quotation.installationCharge,
          otherCharge: 0.0,
          grandTotal,
          paidAmount: parsedPaidAmount,
          balanceAmount,
          paymentMethod,
          paymentStatus,
          notes: notes || `Converted from quotation ${quotation.quotationNumber}.`,
          items: {
            create: quotation.items.map(item => ({
              productId: item.productId,
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      // 4. Update Product Stocks and write Stock Movements
      for (const item of invoice.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod.stockQty < item.quantity && req.user.role !== 'ADMIN') {
          throw new Error(`Insufficient stock for ${prod.name} (Available: ${prod.stockQty})`);
        }

        let updatedProduct;
        if (req.user.role === 'ADMIN') {
          updatedProduct = await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.quantity } },
            select: { stockQty: true },
          });
        } else {
          const updateResult = await tx.product.updateMany({
            where: {
              id: item.productId,
              stockQty: { gte: item.quantity },
            },
            data: { stockQty: { decrement: item.quantity } },
          });
          if (updateResult.count !== 1) {
            throw new Error(`Insufficient stock for ${prod.name} (Available: ${prod.stockQty})`);
          }
          updatedProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stockQty: true },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: 'SALE_OUT',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            quantityIn: 0,
            quantityOut: item.quantity,
            balanceAfter: updatedProduct.stockQty,
            description: `Sold in Invoice ${invoiceNumber} (Converted from QTN ${quotation.quotationNumber})`,
          },
        });
      }

      // 5. Customer Ledger updates
      let currentCustomerBalance = quotation.customer.currentBalance;
      let balanceAfterInvoice = calculateCustomerBalanceAfter(currentCustomerBalance, grandTotal, 0);

      await tx.customerLedger.create({
        data: {
          customerId: quotation.customerId,
          transactionType: 'INVOICE',
          referenceNo: invoiceNumber,
          description: `Invoice Sale - ${invoiceNumber} (Quotation Convert)`,
          debit: grandTotal,
          credit: 0,
          balanceAfter: balanceAfterInvoice,
        },
      });

      currentCustomerBalance = balanceAfterInvoice;

      if (parsedPaidAmount > 0) {
        let balanceAfterPayment = calculateCustomerBalanceAfter(currentCustomerBalance, 0, parsedPaidAmount);

        await tx.customerLedger.create({
          data: {
            customerId: quotation.customerId,
            transactionType: 'PAYMENT',
            referenceNo: invoiceNumber,
            description: `Invoice Payment received - ${invoiceNumber}`,
            debit: 0,
            credit: parsedPaidAmount,
            balanceAfter: balanceAfterPayment,
          },
        });

        // Payment record
        const pNo = await getNextDocumentNumber(tx, {
          counterName: 'payment',
          prefix: 'PAY-',
          modelName: 'payment',
          fieldName: 'paymentNumber',
        });
        await tx.payment.create({
          data: {
            paymentNumber: pNo,
            customerId: quotation.customerId,
            invoiceId: invoice.id,
            date: new Date(),
            amount: parsedPaidAmount,
            paymentMethod,
            notes: `Converted payment on Invoice ${invoiceNumber}`,
          },
        });

        currentCustomerBalance = balanceAfterPayment;
      }

      // Update customer balance in DB
      await tx.customer.update({
        where: { id: quotation.customerId },
        data: { currentBalance: currentCustomerBalance },
      });

      // 6. Schedule delivery if charge > 0
      if (quotation.deliveryCharge > 0) {
        const deliveryNumber = await getNextDocumentNumber(tx, {
          counterName: 'delivery',
          prefix: 'DEL-',
          modelName: 'delivery',
          fieldName: 'deliveryNumber',
        });
        await tx.delivery.create({
          data: {
            deliveryNumber,
            invoiceId: invoice.id,
            customerName: quotation.customer.name,
            phone: quotation.customer.phone,
            address: quotation.customer.address,
            deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day later
            deliveryCharge: quotation.deliveryCharge,
            deliveryStatus: 'Pending',
            notes: `Converted from QTN ${quotation.quotationNumber}`,
          },
        });
      }

      return invoice;
    });

    invalidateQuotationConversionCache();
    return res.status(201).json(result);
  } catch (error) {
    console.error('Convert quotation to invoice error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function convertToOrder(req, res) {
  const { id } = req.params;
  const { expectedDeliveryDate, advancePayment, notes } = req.body;

  if (!expectedDeliveryDate) {
    return res.status(400).json({ error: 'Expected delivery date is required.' });
  }

  const parsedAdvance = parseFloat(advancePayment) || 0.0;
  if (parsedAdvance < 0) {
    return res.status(400).json({ error: 'Advance payment cannot be negative.' });
  }

  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }
    if (quotation.status === 'Converted') {
      return res.status(400).json({ error: 'This quotation has already been converted.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark converted
      const converted = await tx.quotation.updateMany({
        where: {
          id,
          status: { not: 'Converted' },
        },
        data: { status: 'Converted' },
      });
      if (converted.count !== 1) {
        throw new Error('This quotation has already been converted.');
      }

      // 2. Generate Order number
      const settings = await tx.businessSettings.findUnique({ where: { id: 'default' } });
      const prefix = settings ? settings.orderPrefix : 'ORD-';
      const orderNumber = await getNextDocumentNumber(tx, {
        counterName: 'order',
        prefix,
        modelName: 'order',
        fieldName: 'orderNumber',
      });

      const totalAmount = quotation.totalAmount;
      const balanceAmount = Number((totalAmount - parsedAdvance).toFixed(2));
      if (parsedAdvance > totalAmount) {
        throw new Error(`Advance payment cannot exceed order total. Order total: ${totalAmount}`);
      }

      // 3. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: quotation.customerId,
          orderDate: new Date(),
          expectedDeliveryDate: new Date(expectedDeliveryDate),
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          deliveryCharge: quotation.deliveryCharge,
          installationCharge: quotation.installationCharge,
          totalAmount,
          advancePayment: parsedAdvance,
          balanceAmount,
          orderStatus: 'Pending',
          deliveryStatus: 'Not Scheduled',
          notes: notes || `Converted from quotation ${quotation.quotationNumber}`,
          items: {
            create: quotation.items.map(item => ({
              productId: item.productId,
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      // 4. Update Customer Ledger
      let currentBalance = quotation.customer.currentBalance;
      let balanceAfterOrder = calculateCustomerBalanceAfter(currentBalance, totalAmount, 0);

      await tx.customerLedger.create({
        data: {
          customerId: quotation.customerId,
          transactionType: 'ORDER',
          referenceNo: orderNumber,
          description: `Order Created - ${orderNumber} (Quotation Convert)`,
          debit: totalAmount,
          credit: 0,
          balanceAfter: balanceAfterOrder,
        },
      });

      currentBalance = balanceAfterOrder;

      if (parsedAdvance > 0) {
        let balanceAfterAdvance = calculateCustomerBalanceAfter(currentBalance, 0, parsedAdvance);

        await tx.customerLedger.create({
          data: {
            customerId: quotation.customerId,
            transactionType: 'PAYMENT',
            referenceNo: orderNumber,
            description: `Order Advance Payment - ${orderNumber}`,
            debit: 0,
            credit: parsedAdvance,
            balanceAfter: balanceAfterAdvance,
          },
        });

        // Payment record
        const pNo = await getNextDocumentNumber(tx, {
          counterName: 'payment',
          prefix: 'PAY-',
          modelName: 'payment',
          fieldName: 'paymentNumber',
        });
        await tx.payment.create({
          data: {
            paymentNumber: pNo,
            customerId: quotation.customerId,
            orderId: order.id,
            date: new Date(),
            amount: parsedAdvance,
            paymentMethod: 'Cash',
            notes: `Advance payment for Order ${orderNumber}`,
          },
        });

        currentBalance = balanceAfterAdvance;
      }

      // Update customer balance in DB
      await tx.customer.update({
        where: { id: quotation.customerId },
        data: { currentBalance },
      });

      return order;
    });

    invalidateQuotationConversionCache();
    return res.status(201).json(result);
  } catch (error) {
    console.error('Convert quotation to order error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}
