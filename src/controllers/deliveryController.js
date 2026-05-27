import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  try {
    const deliveryCount = await prisma.delivery.count();
    const deliveryNumber = `DEL-${new Date().getFullYear()}-${String(deliveryCount + 1).padStart(4, '0')}`;

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber,
        invoiceId,
        orderId,
        customerName,
        phone,
        address,
        deliveryDate: new Date(deliveryDate),
        deliveryTime,
        driverName,
        vehicleNumber,
        deliveryCharge: parseFloat(deliveryCharge) || 0.0,
        deliveryStatus: driverName ? 'Scheduled' : 'Pending',
        notes,
      },
    });

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
      // Admin/Cashier can update everything
      updateData = {
        customerName: customerName || existing.customerName,
        phone: phone || existing.phone,
        address: address || existing.address,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : existing.deliveryDate,
        deliveryTime: deliveryTime || existing.deliveryTime,
        driverName: driverName || existing.driverName,
        vehicleNumber: vehicleNumber || existing.vehicleNumber,
        deliveryCharge: parseFloat(deliveryCharge) !== undefined ? parseFloat(deliveryCharge) : existing.deliveryCharge,
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

    return res.json(updated);
  } catch (error) {
    console.error('Update delivery status error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
