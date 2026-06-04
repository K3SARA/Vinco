import { PrismaClient } from '@prisma/client';
import { getNextDocumentNumber } from '../utils/documentNumbers.js';
import { invalidateCache } from '../utils/cache.js';

const prisma = new PrismaClient();

function invalidateDeliveryRelatedCache() {
  invalidateCache('dashboard:');
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function parseDeliveryCharge(value, fallback = 0) {
  if (isBlank(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseDeliveryDate(value, fallback = null) {
  if (isBlank(value)) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function getDeliveries(req, res) {
  const { search, deliveryStatus, driverName } = req.query;

  try {
    const where = {};
    if (deliveryStatus) {
      where.deliveryStatus = deliveryStatus;
    }
    if (driverName) {
      where.driverName = driverName;
    }

    let deliveries = await prisma.delivery.findMany({
      where,
      include: {
        invoice: true,
        order: true
      },
      orderBy: { deliveryDate: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      deliveries = deliveries.filter(d => 
        d.deliveryNumber.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        d.address.toLowerCase().includes(q) ||
        (d.invoice && d.invoice.invoiceNumber.toLowerCase().includes(q)) ||
        (d.order && d.order.orderNumber.toLowerCase().includes(q))
      );
    }

    return res.json(deliveries);
  } catch (error) {
    console.error('Get deliveries error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getDeliveryById(req, res) {
  const { id } = req.params;
  try {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { invoice: true, order: true }
    });

    if (!delivery) {
      return res.status(404).json({ error: 'Delivery record not found.' });
    }

    return res.json(delivery);
  } catch (error) {
    console.error('Get delivery error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createDelivery(req, res) {
  const {
    invoiceId,
    orderId,
    customerName,
    phone,
    address,
    deliveryDate,
    deliveryTime,
    driverName,
    vehicleNumber,
    deliveryCharge,
    notes
  } = req.body;

  if (!customerName || !phone || !address || !deliveryDate) {
    return res.status(400).json({ error: 'Customer name, phone, address, and delivery date are required.' });
  }

  const parsedDeliveryDate = parseDeliveryDate(deliveryDate);
  if (!parsedDeliveryDate) {
    return res.status(400).json({ error: 'Delivery date must be valid.' });
  }

  const parsedDeliveryCharge = parseDeliveryCharge(deliveryCharge);
  if (parsedDeliveryCharge === null) {
    return res.status(400).json({ error: 'Delivery charge must be a valid zero or positive amount.' });
  }

  try {
    const delivery = await prisma.$transaction(async (tx) => {
      const deliveryNumber = await getNextDocumentNumber(tx, {
        counterName: 'delivery',
        prefix: 'DEL-',
        modelName: 'delivery',
        fieldName: 'deliveryNumber',
      });

      return tx.delivery.create({
        data: {
          deliveryNumber,
          invoiceId,
          orderId,
          customerName,
          phone,
          address,
          deliveryDate: parsedDeliveryDate,
          deliveryTime,
          driverName,
          vehicleNumber,
          deliveryCharge: parsedDeliveryCharge,
          deliveryStatus: driverName ? 'Scheduled' : 'Pending',
          notes,
        },
      });
    });

    invalidateDeliveryRelatedCache();
    return res.status(201).json(delivery);
  } catch (error) {
    console.error('Create delivery error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateDelivery(req, res) {
  const { id } = req.params;
  const {
    customerName,
    phone,
    address,
    deliveryDate,
    deliveryTime,
    driverName,
    vehicleNumber,
    deliveryCharge,
    deliveryStatus,
    notes,
    deliveredBy
  } = req.body;

  // Enforce role checks. If user is DELIVERY_STAFF, they can ONLY update status & notes.
  const isDeliveryStaff = req.user.role === 'DELIVERY_STAFF';

  try {
    const existing = await prisma.delivery.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Delivery record not found.' });
    }

    let updateData = {};

    if (isDeliveryStaff) {
      // Delivery staff can only modify status, deliveredBy, and notes
      updateData = {
        deliveryStatus: deliveryStatus || existing.deliveryStatus,
        notes: notes || existing.notes,
        deliveredBy: deliveredBy || existing.deliveredBy,
      };
    } else {
      const parsedDeliveryDate = parseDeliveryDate(deliveryDate, existing.deliveryDate);
      if (parsedDeliveryDate === null) {
        return res.status(400).json({ error: 'Delivery date must be valid.' });
      }

      const parsedDeliveryCharge = parseDeliveryCharge(deliveryCharge, existing.deliveryCharge);
      if (parsedDeliveryCharge === null) {
        return res.status(400).json({ error: 'Delivery charge must be a valid zero or positive amount.' });
      }

      // Admin/Cashier can update everything
      updateData = {
        customerName: customerName || existing.customerName,
        phone: phone || existing.phone,
        address: address || existing.address,
        deliveryDate: parsedDeliveryDate,
        deliveryTime: deliveryTime || existing.deliveryTime,
        driverName: driverName || existing.driverName,
        vehicleNumber: vehicleNumber || existing.vehicleNumber,
        deliveryCharge: parsedDeliveryCharge,
        deliveryStatus: deliveryStatus || existing.deliveryStatus,
        deliveredBy: deliveredBy || existing.deliveredBy,
        notes: notes || existing.notes,
      };
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data: updateData,
    });

    // If delivery is complete and relates to an order, we can update order deliveryStatus
    if (deliveryStatus === 'Delivered') {
      if (updated.orderId) {
        await prisma.order.update({
          where: { id: updated.orderId },
          data: { deliveryStatus: 'Delivered' },
        });
      }
    } else if (deliveryStatus === 'Out For Delivery' || deliveryStatus === 'Scheduled' || deliveryStatus === 'Failed') {
      if (updated.orderId) {
        await prisma.order.update({
          where: { id: updated.orderId },
          data: { deliveryStatus: deliveryStatus },
        });
      }
    }

    invalidateDeliveryRelatedCache();
    return res.json(updated);
  } catch (error) {
    console.error('Update delivery error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateDeliveryStatus(req, res) {
  const { id } = req.params;
  const { deliveryStatus, notes } = req.body;

  if (!deliveryStatus) {
    return res.status(400).json({ error: 'Delivery status is required.' });
  }

  try {
    const delivery = await prisma.delivery.findUnique({ where: { id } });
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found.' });
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data: {
        deliveryStatus,
        notes: notes || delivery.notes,
        deliveredBy: req.user.name,
      },
    });

    if (delivery.orderId) {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { deliveryStatus },
      });
    }

    invalidateDeliveryRelatedCache();
    return res.json(updated);
  } catch (error) {
    console.error('Update delivery status error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
