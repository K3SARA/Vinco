import prisma from '../utils/prisma.js';
import { getOrSetCache, invalidateCache } from '../utils/cache.js';

const catalogCachePrefixes = ['dashboard:', 'categories:', 'products:'];

function invalidateCatalogCache() {
  invalidateCache(catalogCachePrefixes);
}

// ==========================================
// CATEGORIES
// ==========================================

export async function getCategories(req, res) {
  try {
    const categories = await getOrSetCache('categories:list', () =>
      prisma.category.findMany({
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { name: 'asc' }
      }),
      120_000
    );
    return res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createCategory(req, res) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const category = await prisma.category.create({
      data: { name, slug },
    });
    invalidateCatalogCache();
    return res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateCategory(req, res) {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const category = await prisma.category.update({
      where: { id },
      data: { name, slug },
    });
    invalidateCatalogCache();
    return res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteCategory(req, res) {
  const { id } = req.params;

  try {
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category that contains products.' });
    }

    await prisma.category.delete({ where: { id } });
    invalidateCatalogCache();
    return res.json({ message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ==========================================
// PRODUCTS
// ==========================================

export async function getProducts(req, res) {
  const { search, categoryId, lowStock, status } = req.query;

  try {
    const where = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (lowStock === 'true') {
      where.stockQty = {
        lte: prisma.product.minStockAlert
      };
      // Wait, SQLite doesn't natively support lte: prisma.product.minStockAlert natively in one line like that in prisma,
      // but in Prisma we can write a raw condition or load all products and filter,
      // or we can use: stockQty: { lte: 5 } (using standard minStockAlert).
      // Let's filter on the database level or load and filter in JS if they want exact low stock match dynamically.
      // Wait! Let's do it using raw condition or filter in JS to support dynamic minStockAlert. Let's do it in JS if lowStock is true!
    }

    let products = await getOrSetCache(
      `products:${JSON.stringify({ search: search || '', categoryId: categoryId || '', lowStock: lowStock || '', status: status || '' })}`,
      async () => {
        let rows = await prisma.product.findMany({
          include: { category: true },
          orderBy: { code: 'asc' },
        });

        if (search) {
          const q = search.toLowerCase();
          rows = rows.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.category && p.category.name.toLowerCase().includes(q)) ||
            (p.material && p.material.toLowerCase().includes(q)) ||
            (p.color && p.color.toLowerCase().includes(q)) ||
            (p.brand && p.brand.toLowerCase().includes(q))
          );
        }

        if (categoryId) {
          rows = rows.filter(p => p.categoryId === categoryId);
        }

        if (lowStock === 'true') {
          rows = rows.filter(p => p.stockQty <= p.minStockAlert);
        }

        if (status) {
          rows = rows.filter(p => p.status === status);
        }

        return rows;
      },
      45_000
    );

    return res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getProductById(req, res) {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Include stock movements
    const movements = await prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { date: 'desc' },
      take: 20,
    });

    return res.json({ ...product, movements });
  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createProduct(req, res) {
  const {
    code, name, categoryId, material, size, color, brand, supplier,
    costPrice, sellingPrice, stockQty, minStockAlert, warrantyPeriod,
    image, description, status
  } = req.body;

  // Validation rules
  if (!name || !code || !categoryId) {
    return res.status(400).json({ error: 'Product Name, SKU/Code and Category are required.' });
  }
  if (costPrice < 0) {
    return res.status(400).json({ error: 'Cost price cannot be negative.' });
  }
  if (sellingPrice < 0) {
    return res.status(400).json({ error: 'Selling price cannot be negative.' });
  }
  if (stockQty < 0 && req.user.role !== 'ADMIN') {
    return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          code,
          name,
          categoryId,
          material,
          size,
          color,
          brand,
          supplier,
          costPrice: parseFloat(costPrice) || 0.0,
          sellingPrice: parseFloat(sellingPrice) || 0.0,
          stockQty: parseFloat(stockQty) || 0.0,
          minStockAlert: parseFloat(minStockAlert) || 5.0,
          warrantyPeriod,
          image,
          description,
          status: status || 'Active',
        },
      });

      // Seed starting stock movement
      if (stockQty > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: 'ADJUSTMENT_IN',
            referenceType: 'MANUAL',
            referenceId: 'INITIAL_STOCK',
            quantityIn: parseFloat(stockQty),
            quantityOut: 0,
            balanceAfter: parseFloat(stockQty),
            description: 'Initial stock setup on product creation.',
          },
        });
      }

      return product;
    });

    invalidateCatalogCache();
    return res.status(201).json(result);
  } catch (error) {
    console.error('Create product error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Product code/SKU already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const {
    code, name, categoryId, material, size, color, brand, supplier,
    costPrice, sellingPrice, stockQty, minStockAlert, warrantyPeriod,
    image, description, status, manualStockAdjustReason
  } = req.body;

  if (!name || !code || !categoryId) {
    return res.status(400).json({ error: 'Product Name, SKU/Code and Category are required.' });
  }
  if (costPrice < 0) {
    return res.status(400).json({ error: 'Cost price cannot be negative.' });
  }
  if (sellingPrice < 0) {
    return res.status(400).json({ error: 'Selling price cannot be negative.' });
  }

  try {
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const targetStock = parseFloat(stockQty);
    const currentStock = existingProduct.stockQty;

    // Check admin authorization if attempting to reduce below 0
    if (targetStock < 0 && req.user.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          code,
          name,
          categoryId,
          material,
          size,
          color,
          brand,
          supplier,
          costPrice: parseFloat(costPrice) || 0.0,
          sellingPrice: parseFloat(sellingPrice) || 0.0,
          stockQty: targetStock,
          minStockAlert: parseFloat(minStockAlert) || 5.0,
          warrantyPeriod,
          image,
          description,
          status: status || 'Active',
        },
      });

      // Handle stock movement for manual adjustments
      if (targetStock !== currentStock) {
        const diff = targetStock - currentStock;
        const movementType = diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        const qtyIn = diff > 0 ? diff : 0;
        const qtyOut = diff < 0 ? Math.abs(diff) : 0;

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType,
            referenceType: 'MANUAL',
            referenceId: 'MANUAL_UPDATE',
            quantityIn: qtyIn,
            quantityOut: qtyOut,
            balanceAfter: targetStock,
            description: manualStockAdjustReason || `Manual stock adjustment from ${currentStock} to ${targetStock}`,
          },
        });
      }

      return product;
    });

    invalidateCatalogCache();
    return res.json(result);
  } catch (error) {
    console.error('Update product error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Product code/SKU already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteProduct(req, res) {
  const { id } = req.params;

  try {
    // Cannot delete product if used in Invoices
    const invoiceCount = await prisma.invoiceItem.count({
      where: { productId: id },
    });

    if (invoiceCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product: It has already been sold in invoices. Try marking it as Inactive instead.'
      });
    }

    // Also check orders
    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product: It is linked to active customer orders.'
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    invalidateCatalogCache();
    return res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
