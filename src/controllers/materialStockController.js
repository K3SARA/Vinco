import prisma from '../utils/prisma.js';

export async function getMaterialsStock(req, res) {
  const { search, type } = req.query;
  try {
    const where = {};
    if (type) {
      where.material_type = type; // Timber or Board
    }
    if (search) {
      where.material_name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const materials = await prisma.materialStock.findMany({
      where,
      orderBy: { material_name: 'asc' },
    });

    return res.json(materials);
  } catch (error) {
    console.error('Get materials stock error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getMaterialStockById(req, res) {
  const { id } = req.params;
  try {
    const material = await prisma.materialStock.findUnique({
      where: { material_id: id },
    });
    if (!material) {
      return res.status(404).json({ error: 'Material stock record not found.' });
    }
    return res.json(material);
  } catch (error) {
    console.error('Get material stock by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createMaterialStock(req, res) {
  const {
    material_name,
    material_type,
    low_stock_threshold_sqft,
    cost_per_sqft,
    current_stock_sqft = 0,
  } = req.body;

  if (!material_name || !material_name.trim()) {
    return res.status(400).json({ error: 'Material name is required.' });
  }
  if (!material_type || !['Timber', 'Board'].includes(material_type)) {
    return res.status(400).json({ error: 'Material type must be Timber or Board.' });
  }

  const stock = parseFloat(current_stock_sqft) || 0;
  const threshold = parseFloat(low_stock_threshold_sqft) || 0;
  const cost = parseFloat(cost_per_sqft) || 0;

  try {
    const history = [];
    if (stock !== 0) {
      history.push({
        date: new Date().toISOString(),
        type: 'INITIAL',
        reference: 'Initial Setup',
        change: stock,
        balance: stock,
      });
    }

    const material = await prisma.materialStock.create({
      data: {
        material_name: material_name.trim(),
        material_type,
        unit: 'sq ft',
        current_stock_sqft: stock,
        low_stock_threshold_sqft: threshold,
        cost_per_sqft: cost,
        stock_history: history,
      },
    });

    return res.status(201).json(material);
  } catch (error) {
    console.error('Create material stock error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Material with this name already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateMaterialStock(req, res) {
  const { id } = req.params;
  const {
    material_name,
    material_type,
    low_stock_threshold_sqft,
    cost_per_sqft,
  } = req.body;

  if (!material_name || !material_name.trim()) {
    return res.status(400).json({ error: 'Material name is required.' });
  }
  if (!material_type || !['Timber', 'Board'].includes(material_type)) {
    return res.status(400).json({ error: 'Material type must be Timber or Board.' });
  }

  try {
    const material = await prisma.materialStock.update({
      where: { material_id: id },
      data: {
        material_name: material_name.trim(),
        material_type,
        low_stock_threshold_sqft: parseFloat(low_stock_threshold_sqft) || 0,
        cost_per_sqft: parseFloat(cost_per_sqft) || 0,
      },
    });
    return res.json(material);
  } catch (error) {
    console.error('Update material stock error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Material with this name already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function adjustMaterialStock(req, res) {
  const { id } = req.params;
  const { quantity_change, reason = 'Manual Adjustment' } = req.body;

  const change = parseFloat(quantity_change);
  if (isNaN(change) || change === 0) {
    return res.status(400).json({ error: 'Valid non-zero quantity change is required.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.materialStock.findUnique({
        where: { material_id: id },
      });

      if (!material) {
        throw new Error('Material stock record not found.');
      }

      const newStock = Number((material.current_stock_sqft + change).toFixed(2));
      const history = Array.isArray(material.stock_history) ? material.stock_history : [];

      history.push({
        date: new Date().toISOString(),
        type: change > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        reference: reason || 'Manual Adjustment',
        change,
        balance: newStock,
      });

      return await tx.materialStock.update({
        where: { material_id: id },
        data: {
          current_stock_sqft: newStock,
          stock_history: history,
        },
      });
    });

    return res.json(result);
  } catch (error) {
    console.error('Adjust material stock error:', error);
    return res.status(400).json({ error: error.message || 'Internal server error.' });
  }
}

export async function deleteMaterialStock(req, res) {
  const { id } = req.params;
  try {
    await prisma.materialStock.delete({
      where: { material_id: id },
    });
    return res.json({ message: 'Material stock record deleted successfully.' });
  } catch (error) {
    console.error('Delete material stock error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
