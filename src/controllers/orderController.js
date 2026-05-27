import { PrismaClient } from '@prisma/client';
import { calculateCustomerBalanceAfter } from '../utils/ledger.js';

const prisma = new PrismaClient();

export async function getOrders(req, res) {
  const { search, orderStatus, deliveryStatus } = req.query;

  try {
    const where = {};
    if (orderStatus) {
      where.orderStatus = orderStatus;
    }
    if (deliveryStatus) {
      where.deliveryStatus = deliveryStatus;
    }

    let orders = await prisma.order.findMany({
      where,
      include: { customer: true },
      orderBy: { orderDate: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(ord => 
        ord.orderNumber.toLowerCase().includes(q) ||
        ord.customer.name.toLowerCase().includes(q) ||
        ord.customer.phone.includes(q)
      );
    }

    return res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getOrderById(req, res) {
  const { id } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true }
        },
        payments: true,
        deliveries: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createOrder(req, res) {
  const {
    customerId,
    expectedDeliveryDate,
    items,
    discount,
    deliveryCharge,
    installationCharge,
    advancePayment,
    notes,
    reserveStock // Boolean option passed from front-end toggled setting
  } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'Customer is required.' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }
  if (!expectedDeliveryDate) {
    return res.status(400).json({ error: 'Expected delivery date is required.' });
  }

  const parsedDiscount = parseFloat(discount) || 0.0;
  const parsedDelCharge = parseFloat(deliveryCharge) || 0.0;
  const parsedInstCharge = parseFloat(installationCharge) || 0.0;
  const parsedAdvance = parseFloat(advancePayment) || 0.0;

  if (parsedAdvance < 0) {
    return res.status(400).json({ error: 'Advance payment cannot be negative.' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(400).json({ error: 'Selected customer does not exist.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsData = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        const itemDisc = parseFloat(item.discount) || 0.0;

        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantity must be greater than zero.');
        }

        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.status !== 'Active') {
          throw new Error(`Product ${item.productCode || 'SKU'} is inactive or not found.`);
        }

        // Validate stock if reserving stock
        if (reserveStock && product.stockQty < qty && req.user.role !== 'ADMIN') {
          throw new Error(`Insufficient stock to reserve for ${product.name}. Available: ${product.stockQty}, Requested: ${qty}`);
        }

        const lineTotal = Number((qty * price - itemDisc).toFixed(2));
        subtotal += lineTotal;

        orderItemsData.push({
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
      const balanceAmount = Number((totalAmount - parsedAdvance).toFixed(2));

      // Generate order number
      const orderCount = await tx.order.count();
      const settings = await tx.businessSettings.findUnique({ where: { id: 'default' } });
      const prefix = settings ? settings.orderPrefix : 'ORD-';
      const orderNumber = `${prefix}${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          expectedDeliveryDate: new Date(expectedDeliveryDate),
          subtotal,
          discount: parsedDiscount,
          deliveryCharge: parsedDelCharge,
          installationCharge: parsedInstCharge,
          totalAmount,
          advancePayment: parsedAdvance,
          balanceAmount,
          orderStatus: 'Pending',
          deliveryStatus: 'Not Scheduled',
          notes: notes || (reserveStock ? '[Stock Reserved]' : '[Stock Not Reserved]'),
          items: {
            create: orderItemsData,
          },
        },
        include: { items: true },
      });

      // Handle stock reservation if reserveStock is ON
      if (reserveStock) {
        for (const item of order.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          const newStock = prod.stockQty - item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: newStock },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'ORDER_RESERVE',
              referenceType: 'ORDER',
              referenceId: order.id,
              quantityIn: 0,
              quantityOut: item.quantity,
              balanceAfter: newStock,
              description: `Reserved for Customer Order ${orderNumber}`,
            },
          });
        }
      }

      // Customer Ledger updates
      // Debit totalAmount
      let currentBalance = customer.currentBalance;
      let balanceAfterOrder = calculateCustomerBalanceAfter(currentBalance, totalAmount, 0);

      await tx.customerLedger.create({
        data: {
          customerId,
          date: order.orderDate,
          transactionType: 'ORDER',
          referenceNo: orderNumber,
          description: `Order Booked - ${orderNumber}`,
          debit: totalAmount,
          credit: 0,
          balanceAfter: balanceAfterOrder,
        },
      });

      currentBalance = balanceAfterOrder;

      // Credit advancePayment
      if (parsedAdvance > 0) {
        let balanceAfterAdvance = calculateCustomerBalanceAfter(currentBalance, 0, parsedAdvance);

        await tx.customerLedger.create({
          data: {
            customerId,
            date: order.orderDate,
            transactionType: 'PAYMENT',
            referenceNo: orderNumber,
            description: `Order Advance Received - ${orderNumber}`,
            debit: 0,
            credit: parsedAdvance,
            balanceAfter: balanceAfterAdvance,
          },
        });

        // Payment record
        const paymentCount = await tx.payment.count();
        const paymentNo = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;
        await tx.payment.create({
          data: {
            paymentNumber: paymentNo,
            customerId,
            orderId: order.id,
            date: order.orderDate,
            amount: parsedAdvance,
            paymentMethod: 'Cash',
            notes: `Advance payment on Order ${orderNumber}`,
          },
        });

        currentBalance = balanceAfterAdvance;
      }

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: { currentBalance },
      });

      return order;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function addOrderPayment(req, res) {
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
      const order = await tx.order.findUnique({
        where: { id },
        include: { customer: true },
      });

      if (!order) {
        throw new Error('Order not found.');
      }
      if (order.balanceAmount <= 0) {
        throw new Error('Order is already fully paid.');
      }
      if (order.orderStatus === 'Cancelled') {
        throw new Error('Cannot add payment to a cancelled order.');
      }

      const newAdvance = Number((order.advancePayment + paymentAmt).toFixed(2));
      const newBalance = Number((order.totalAmount - newAdvance).toFixed(2));

      if (newBalance < 0) {
        throw new Error(`Payment exceeds order outstanding balance. Outstanding: ${order.balanceAmount}`);
      }

      // Update Order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          advancePayment: newAdvance,
          balanceAmount: newBalance,
        },
      });

      // Create Payment record
      const paymentCount = await tx.payment.count();
      const paymentNo = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;
      await tx.payment.create({
        data: {
          paymentNumber: paymentNo,
          customerId: order.customerId,
          orderId: id,
          date: date ? new Date(date) : new Date(),
          amount: paymentAmt,
          paymentMethod,
          referenceNumber,
          notes,
        },
      });

      // Update customer ledger: credit the payment
      const balanceAfter = calculateCustomerBalanceAfter(order.customer.currentBalance, 0, paymentAmt);

      await tx.customerLedger.create({
        data: {
          customerId: order.customerId,
          date: date ? new Date(date) : new Date(),
          transactionType: 'PAYMENT',
          referenceNo: order.orderNumber,
          description: `Payment received on Order ${order.orderNumber}`,
          debit: 0,
          credit: paymentAmt,
          balanceAfter,
        },
      });

      // Update customer current balance
      await tx.customer.update({
        where: { id: order.customerId },
        data: { currentBalance: balanceAfter },
      });

      return updatedOrder;
    });

    return res.json(result);
  } catch (error) {
    console.error('Order payment error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function convertToInvoice(req, res) {
  const { id } = req.params;
  const { paymentMethod, notes } = req.body;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { customer: true, items: true },
      });

      if (!order) {
        throw new Error('Order not found.');
      }
      if (order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled') {
        throw new Error(`Cannot convert order in ${order.orderStatus} status.`);
      }

      // Check if stock was reserved
      const wasStockReserved = order.notes && order.notes.includes('[Stock Reserved]');

      // Generate invoice number
      const invoiceCount = await tx.invoice.count();
      const settings = await tx.businessSettings.findUnique({ where: { id: 'default' } });
      const prefix = settings ? settings.invoicePrefix : 'INV-';
      const invoiceNumber = `${prefix}${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

      // Convert order items to invoice items data
      const invoiceItems = order.items.map(item => ({
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
      }));

      // Determine invoice payment status
      let paymentStatus = 'CREDIT';
      if (order.balanceAmount === 0) {
        paymentStatus = 'PAID';
      } else if (order.advancePayment > 0) {
        paymentStatus = 'PARTIAL';
      }

      // Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          date: new Date(),
          customerId: order.customerId,
          customerPhone: order.customer.phone,
          customerAddress: order.customer.address,
          salesperson: 'Converted from Order',
          subtotal: order.subtotal,
          discount: order.discount,
          deliveryCharge: order.deliveryCharge,
          installationCharge: order.installationCharge,
          otherCharge: 0.0,
          grandTotal: order.totalAmount,
          paidAmount: order.advancePayment,
          balanceAmount: order.balanceAmount,
          paymentMethod: paymentMethod || 'Cash',
          paymentStatus,
          notes: notes || `Converted from Order ${order.orderNumber}.`,
          items: {
            create: invoiceItems,
          },
        },
      });

      // Update stock movement if stock was NOT reserved previously
      if (!wasStockReserved) {
        for (const item of order.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod.stockQty < item.quantity && req.user.role !== 'ADMIN') {
            throw new Error(`Insufficient stock for ${prod.name}. Available: ${prod.stockQty}`);
          }
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
              description: `Sold in Invoice ${invoiceNumber} (Converted from Order ${order.orderNumber})`,
            },
          });
        }
      } else {
        // If stock WAS reserved, convert the reservation into active sale
        for (const item of order.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'ORDER_RELEASE',
              referenceType: 'INVOICE',
              referenceId: invoice.id,
              quantityIn: item.quantity,
              quantityOut: 0,
              balanceAfter: prod.stockQty + item.quantity,
              description: `Release order reservation to complete sale for Invoice ${invoiceNumber}`,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'SALE_OUT',
              referenceType: 'INVOICE',
              referenceId: invoice.id,
              quantityIn: 0,
              quantityOut: item.quantity,
              balanceAfter: prod.stockQty,
              description: `Finalized sale for Invoice ${invoiceNumber}`,
            },
          });
        }
      }

      // Link payments that were assigned to the order to the invoice
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { invoiceId: invoice.id },
      });

      // Update Order status
      await tx.order.update({
        where: { id },
        data: {
          orderStatus: 'Delivered',
          deliveryStatus: 'Delivered',
        },
      });

      // Update delivery if scheduled
      await tx.delivery.updateMany({
        where: { orderId: id },
        data: { invoiceId: invoice.id, deliveryStatus: 'Delivered' },
      });

      // Update customer ledger
      // Since the order already added a debit of totalAmount and a credit of advancePayment,
      // the ledger is already in balance for the customer.
      // We don't need to add another invoice debit/credit in customer ledger, otherwise it would double-charge!
      // But we can log a descriptive entry or swap reference to link them cleanly.
      await tx.customerLedger.create({
        data: {
          customerId: order.customerId,
          transactionType: 'INVOICE',
          referenceNo: invoiceNumber,
          description: `Order converted to Invoice: ${invoiceNumber}`,
          debit: 0,
          credit: 0,
          balanceAfter: order.customer.currentBalance,
        },
      });

      return invoice;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Convert order to invoice error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function cancelOrder(req, res) {
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { customer: true, items: true },
      });

      if (!order) {
        throw new Error('Order not found.');
      }
      if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Delivered') {
        throw new Error(`Cannot cancel order in ${order.orderStatus} status.`);
      }

      // 1. Cancel order status
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { orderStatus: 'Cancelled' },
      });

      // 2. Release stocks if reserved
      const wasStockReserved = order.notes && order.notes.includes('[Stock Reserved]');
      if (wasStockReserved) {
        for (const item of order.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          const restoredStock = prod.stockQty + item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: restoredStock },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'ORDER_RELEASE',
              referenceType: 'ORDER',
              referenceId: order.id,
              quantityIn: item.quantity,
              quantityOut: 0,
              balanceAfter: restoredStock,
              description: `Released reserved stock - Cancelled Order ${order.orderNumber}`,
            },
          });
        }
      }

      // 3. Reverse customer ledger
      let currentBalance = order.customer.currentBalance;

      // Credit the debit amount of order
      let balanceAfterReverseOrder = calculateCustomerBalanceAfter(currentBalance, 0, order.totalAmount);
      await tx.customerLedger.create({
        data: {
          customerId: order.customerId,
          transactionType: 'ADJUSTMENT',
          referenceNo: order.orderNumber,
          description: `Cancelled Order Reversal - ${order.orderNumber}`,
          debit: 0,
          credit: order.totalAmount,
          balanceAfter: balanceAfterReverseOrder,
        },
      });

      currentBalance = balanceAfterReverseOrder;

      // Debit the advance payment amount (which was previously credited)
      if (order.advancePayment > 0) {
        let balanceAfterReverseAdvance = calculateCustomerBalanceAfter(currentBalance, order.advancePayment, 0);
        await tx.customerLedger.create({
          data: {
            customerId: order.customerId,
            transactionType: 'ADJUSTMENT',
            referenceNo: order.orderNumber,
            description: `Cancelled Order Advance Reversal - ${order.orderNumber}`,
            debit: order.advancePayment,
            credit: 0,
            balanceAfter: balanceAfterReverseAdvance,
          },
        });

        currentBalance = balanceAfterReverseAdvance;
      }

      // Update customer balance in DB
      await tx.customer.update({
        where: { id: order.customerId },
        data: { currentBalance },
      });

      // 4. Cancel deliveries
      await tx.delivery.updateMany({
        where: { orderId: id },
        data: { deliveryStatus: 'Failed', notes: 'Delivery cancelled: Order cancelled.' },
      });

      return updatedOrder;
    });

    return res.json({ message: 'Order cancelled successfully.', order: result });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}
