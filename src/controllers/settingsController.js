import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { invalidateCache } from '../utils/cache.js';

const prisma = new PrismaClient();

const ALLOWED_USER_ROLES = new Set(['ADMIN', 'CASHIER', 'SALESPERSON', 'DELIVERY_STAFF']);

function normalizeRequiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUserRole(role) {
  const normalized = typeof role === 'string' ? role.trim().toUpperCase() : '';
  return ALLOWED_USER_ROLES.has(normalized) ? normalized : null;
}

function parseActiveValue(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return null;
}

// ==========================================
// BUSINESS SETTINGS
// ==========================================

export async function getBusinessSettings(req, res) {
  try {
    let settings = await prisma.businessSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          id: 'default',
          shopName: 'Alight Furniture & Timbers',
          ownerName: 'Owner Name',
          address: 'Shop Address',
          phone1: 'Phone 1',
          phone2: 'Phone 2',
          email: 'Email',
          website: 'Website',
          receiptFooterText: 'Thank you for shopping with us.',
        },
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Get business settings error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateBusinessSettings(req, res) {
  const {
    shopName, ownerName, address, phone1, phone2, email, website,
    logoUrl, taxNumber, invoicePrefix, quotationPrefix, orderPrefix,
    currency, receiptFooterText
  } = req.body;

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can update settings.' });
  }

  try {
    const settings = await prisma.businessSettings.upsert({
      where: { id: 'default' },
      update: {
        shopName, ownerName, address, phone1, phone2, email, website,
        logoUrl, taxNumber, invoicePrefix, quotationPrefix, orderPrefix,
        currency, receiptFooterText
      },
      create: {
        id: 'default',
        shopName, ownerName, address, phone1, phone2, email, website,
        logoUrl, taxNumber, invoicePrefix, quotationPrefix, orderPrefix,
        currency, receiptFooterText
      },
    });

    return res.json(settings);
  } catch (error) {
    console.error('Update business settings error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ==========================================
// RECEIPT SETTINGS
// ==========================================

export async function getReceiptSettings(req, res) {
  try {
    let settings = await prisma.receiptSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.receiptSettings.create({
        data: {
          id: 'default',
        },
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Get receipt settings error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateReceiptSettings(req, res) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can update receipt settings.' });
  }

  try {
    const settings = await prisma.receiptSettings.upsert({
      where: { id: 'default' },
      update: req.body,
      create: {
        id: 'default',
        ...req.body
      },
    });

    return res.json(settings);
  } catch (error) {
    console.error('Update receipt settings error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ==========================================
// USER MANAGEMENT (ADMIN ONLY)
// ==========================================

export async function getUsers(req, res) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { username: 'asc' },
    });
    return res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createUser(req, res) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const { username, password, name, role } = req.body;
  const cleanUsername = normalizeRequiredText(username);
  const cleanName = normalizeRequiredText(name);
  const cleanPassword = typeof password === 'string' ? password : '';
  const cleanRole = normalizeUserRole(role);

  if (!cleanUsername || !cleanPassword || !cleanName || !role) {
    return res.status(400).json({ error: 'Username, password, name, and role are required.' });
  }

  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  if (!cleanRole) {
    return res.status(400).json({ error: 'User role is invalid.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        password: hashedPassword,
        name: cleanName,
        role: cleanRole,
      },
    });

    return res.status(201).json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: user.active,
    });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateUser(req, res) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const { id } = req.params;
  const { name, role, active, password } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const cleanName = normalizeRequiredText(name) || existing.name;
    const cleanRole = role === undefined ? existing.role : normalizeUserRole(role);
    const cleanActive = parseActiveValue(active, existing.active);

    if (!cleanRole) {
      return res.status(400).json({ error: 'User role is invalid.' });
    }

    if (cleanActive === null) {
      return res.status(400).json({ error: 'User active status must be true or false.' });
    }

    if (existing.id === req.user.id && (cleanRole !== 'ADMIN' || cleanActive === false)) {
      return res.status(400).json({ error: 'You cannot demote or deactivate your own admin account.' });
    }

    const data = {
      name: cleanName,
      role: cleanRole,
      active: cleanActive,
    };

    if (typeof password === 'string' && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    invalidateCache(`auth:user:${id}`);

    return res.json({
      id: updated.id,
      username: updated.username,
      name: updated.name,
      role: updated.role,
      active: updated.active,
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function deleteUser(req, res) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent self-deletion
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    await prisma.user.delete({ where: { id } });
    invalidateCache(`auth:user:${id}`);
    return res.json({ message: 'User account deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
