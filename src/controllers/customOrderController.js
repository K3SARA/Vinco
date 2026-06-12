import prisma from '../utils/prisma.js';

// Helper to auto-generate CO-XXX order numbers
async function getNextCustomOrderNumber(tx) {
  const counterName = 'custom_order';
  const existing = await tx.documentCounter.findUnique({
    where: { name: counterName },
  });

  let nextVal = 1;
  if (!existing) {
    const latest = await tx.customOrder.findFirst({
      orderBy: { order_number: 'desc' },
      select: { order_number: true },
    });
    if (latest && latest.order_number) {
      const match = latest.order_number.match(/CO-(\d+)/);
      if (match) {
        nextVal = parseInt(match[1], 10) + 1;
      }
    }
    await tx.documentCounter.create({
      data: { name: counterName, value: nextVal },
    });
  } else {
    const updated = await tx.documentCounter.update({
      where: { name: counterName },
      data: { value: { increment: 1 } },
    });
    nextVal = updated.value;
  }

  return `CO-${String(nextVal).padStart(3, '0')}`;
}

export async function getCustomOrders(req, res) {
  const { search, stage } = req.query;
  try {
    const where = {};
    if (stage) {
      where.stage = stage;
    }

    let orders = await prisma.customOrder.findMany({
      where,
      include: {
        customer: true,
        assigned_carpenter: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter((o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.furniture_title.toLowerCase().includes(q) ||
        o.stage.toLowerCase().includes(q)
      );
    }

    return res.json(orders);
  } catch (error) {
    console.error('Get custom orders error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getCustomOrderById(req, res) {
  const { id } = req.params;
  try {
    const order = await prisma.customOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        assigned_carpenter: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Custom order not found.' });
    }

    // Fetch actual carpenter payments for this order
    const payments = await prisma.carpenterPayment.findMany({
      where: {
        customOrderNumber: order.order_number,
      },
    });

    const actual_labor_payments = payments.reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      ...order,
      actual_labor_payments,
      carpenter_payments: payments,
    });
  } catch (error) {
    console.error('Get custom order by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createCustomOrder(req, res) {
  const {
    customer_id,
    order_date,
    furniture_title,
    dim_length_cm,
    dim_width_cm,
    dim_height_cm,
    timber_type,
    timber_grade,
    finish,
    additional_materials,
    material_line_items,
    est_days,
    daily_rate,
    quote_price,
    assigned_carpenter_id,
    notes,
  } = req.body;

  if (!customer_id) {
    return res.status(400).json({ error: 'Customer is required.' });
  }
  if (!furniture_title || !furniture_title.trim()) {
    return res.status(400).json({ error: 'Furniture title/type is required.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order_number = await getNextCustomOrderNumber(tx);
      const design_reference_file = req.file ? `/uploads/${req.file.filename}` : null;

      const parsed_material_items = typeof material_line_items === 'string'
        ? JSON.parse(material_line_items)
        : (material_line_items || []);

      const activity_log = [{
        timestamp: new Date().toISOString(),
        event: 'Custom Order Created (Draft)',
        user: req.user?.name || 'Admin',
      }];

      if (notes && notes.trim()) {
        activity_log.push({
          timestamp: new Date().toISOString(),
          event: `Note added: ${notes.trim()}`,
          user: req.user?.name || 'Admin',
        });
      }

      return await tx.customOrder.create({
        data: {
          order_number,
          customer_id,
          order_date: order_date ? new Date(order_date) : new Date(),
          furniture_title: furniture_title.trim(),
          stage: 'Order placed',
          dim_length_cm: parseFloat(dim_length_cm) || null,
          dim_width_cm: parseFloat(dim_width_cm) || null,
          dim_height_cm: parseFloat(dim_height_cm) || null,
          timber_type: timber_type || null,
          timber_grade: timber_grade || null,
          finish: finish || null,
          additional_materials: additional_materials || null,
          design_reference_file,
          material_line_items: parsed_material_items,
          est_days: parseFloat(est_days) || null,
          daily_rate: parseFloat(daily_rate) || null,
          quote_price: parseFloat(quote_price) || null,
          assigned_carpenter_id: assigned_carpenter_id || null,
          activity_log,
        },
      });
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create custom order error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateCustomOrder(req, res) {
  const { id } = req.params;
  const {
    customer_id,
    order_date,
    furniture_title,
    dim_length_cm,
    dim_width_cm,
    dim_height_cm,
    timber_type,
    timber_grade,
    finish,
    additional_materials,
    material_line_items,
    est_days,
    daily_rate,
    quote_price,
    assigned_carpenter_id,
    notes,
  } = req.body;

  if (!furniture_title || !furniture_title.trim()) {
    return res.status(400).json({ error: 'Furniture title/type is required.' });
  }

  try {
    const existingOrder = await prisma.customOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Custom order not found.' });
    }

    const design_reference_file = req.file ? `/uploads/${req.file.filename}` : existingOrder.design_reference_file;

    const parsed_material_items = typeof material_line_items === 'string'
      ? JSON.parse(material_line_items)
      : (material_line_items || []);

    const activity_log = Array.isArray(existingOrder.activity_log)
      ? existingOrder.activity_log
      : [];

    activity_log.push({
      timestamp: new Date().toISOString(),
      event: 'Custom Order details updated',
      user: req.user?.name || 'Admin',
    });

    if (notes && notes.trim()) {
      activity_log.push({
        timestamp: new Date().toISOString(),
        event: `Note added: ${notes.trim()}`,
        user: req.user?.name || 'Admin',
      });
    }

    const updated = await prisma.customOrder.update({
      where: { id },
      data: {
        customer_id: customer_id || existingOrder.customer_id,
        order_date: order_date ? new Date(order_date) : existingOrder.order_date,
        furniture_title: furniture_title.trim(),
        dim_length_cm: parseFloat(dim_length_cm) || null,
        dim_width_cm: parseFloat(dim_width_cm) || null,
        dim_height_cm: parseFloat(dim_height_cm) || null,
        timber_type: timber_type || null,
        timber_grade: timber_grade || null,
        finish: finish || null,
        additional_materials: additional_materials || null,
        design_reference_file,
        material_line_items: parsed_material_items,
        est_days: parseFloat(est_days) || null,
        daily_rate: parseFloat(daily_rate) || null,
        quote_price: parseFloat(quote_price) || null,
        assigned_carpenter_id: assigned_carpenter_id || null,
        activity_log,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update custom order error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function addCustomOrderNote(req, res) {
  const { id } = req.params;
  const { note } = req.body;

  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'Note content is required.' });
  }

  try {
    const order = await prisma.customOrder.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Custom order not found.' });
    }

    const activity_log = Array.isArray(order.activity_log) ? order.activity_log : [];
    activity_log.push({
      timestamp: new Date().toISOString(),
      event: `Manual Note: ${note.trim()}`,
      user: req.user?.name || 'Admin',
    });

    const updated = await prisma.customOrder.update({
      where: { id },
      data: { activity_log },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Add custom order note error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// Update stage lifecycle with Stock Deductions / Reversals
export async function updateCustomOrderStage(req, res) {
  const { id } = req.params;
  const { stage, forceStageChange = false, restoreStock = false } = req.body;

  const validStages = ['Order placed', 'Quoted', 'Confirmed', 'In production', 'Ready', 'Delivered'];
  if (!stage || !validStages.includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage value.' });
  }

  try {
    const order = await prisma.customOrder.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ error: 'Custom order not found.' });
    }

    const oldStage = order.stage;
    if (oldStage === stage) {
      return res.json(order);
    }

    const materialItems = Array.isArray(order.material_line_items) ? order.material_line_items : [];

    // Is it transition to Confirmed (or beyond) from a lower stage?
    const isMovingToConfirmed = !['Confirmed', 'In production', 'Ready', 'Delivered'].includes(oldStage) &&
      ['Confirmed', 'In production', 'Ready', 'Delivered'].includes(stage);

    // Is it reverting from Confirmed (or beyond) back to Quoted or Order Placed?
    const isRevertingFromConfirmed = ['Confirmed', 'In production', 'Ready', 'Delivered'].includes(oldStage) &&
      ['Order placed', 'Quoted'].includes(stage);

    const stockWarnings = [];
    const stockDeductionPlan = [];

    // If moving to confirmed, inspect stock availability
    if (isMovingToConfirmed) {
      for (const item of materialItems) {
        if (item.material_id && parseFloat(item.qty) > 0) {
          const material = await prisma.materialStock.findUnique({
            where: { material_id: item.material_id },
          });

          if (material) {
            const reqQty = parseFloat(item.qty);
            const available = material.current_stock_sqft;

            if (available < reqQty) {
              stockWarnings.push({
                material_id: material.material_id,
                material_name: material.material_name,
                required: reqQty,
                available: available,
              });
            }

            stockDeductionPlan.push({
              material_id: material.material_id,
              material_name: material.material_name,
              current_stock: available,
              deduct_qty: reqQty,
            });
          }
        }
      }

      // If we have warnings and the user has not forced the stage change, abort and return warnings
      if (stockWarnings.length > 0 && !forceStageChange) {
        return res.status(200).json({
          status: 'warning',
          message: 'Insufficient materials stock to confirm the order.',
          warnings: stockWarnings,
        });
      }
    }

    // Execute stage change and stock operations
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Perform stock deductions if moving to Confirmed
      if (isMovingToConfirmed && stockDeductionPlan.length > 0) {
        for (const plan of stockDeductionPlan) {
          const newStock = Number((plan.current_stock - plan.deduct_qty).toFixed(2));
          const mat = await tx.materialStock.findUnique({
            where: { material_id: plan.material_id },
          });

          const history = Array.isArray(mat.stock_history) ? mat.stock_history : [];
          history.push({
            date: new Date().toISOString(),
            type: 'DEDUCTION',
            reference: order.order_number,
            change: -plan.deduct_qty,
            balance: newStock,
          });

          await tx.materialStock.update({
            where: { material_id: plan.material_id },
            data: {
              current_stock_sqft: newStock,
              stock_history: history,
            },
          });
        }
      }

      // 2. Perform stock reversals if reverting from Confirmed and restoreStock is true
      if (isRevertingFromConfirmed && restoreStock) {
        for (const item of materialItems) {
          if (item.material_id && parseFloat(item.qty) > 0) {
            const mat = await tx.materialStock.findUnique({
              where: { material_id: item.material_id },
            });

            if (mat) {
              const reqQty = parseFloat(item.qty);
              const newStock = Number((mat.current_stock_sqft + reqQty).toFixed(2));
              const history = Array.isArray(mat.stock_history) ? mat.stock_history : [];

              history.push({
                date: new Date().toISOString(),
                type: 'REVERSAL',
                reference: order.order_number,
                change: reqQty,
                balance: newStock,
              });

              await tx.materialStock.update({
                where: { material_id: item.material_id },
                data: {
                  current_stock_sqft: newStock,
                  stock_history: history,
                },
              });
            }
          }
        }
      }

      // 3. Log event in activity log
      const activity_log = Array.isArray(order.activity_log) ? order.activity_log : [];
      activity_log.push({
        timestamp: new Date().toISOString(),
        event: `Stage updated from "${oldStage}" to "${stage}"`,
        user: req.user?.name || 'Admin',
      });

      return await tx.customOrder.update({
        where: { id },
        data: {
          stage,
          activity_log,
        },
      });
    });

    return res.json({ status: 'success', order: updatedOrder });
  } catch (error) {
    console.error('Update custom order stage error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteCustomOrder(req, res) {
  const { id } = req.params;
  try {
    await prisma.customOrder.delete({
      where: { id },
    });
    return res.json({ message: 'Custom order deleted successfully.' });
  } catch (error) {
    console.error('Delete custom order error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
// file change trigger
