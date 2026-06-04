import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getJwtSecret } from '../utils/authConfig.js';

const prisma = new PrismaClient();
const JWT_SECRET = getJwtSecret();

export async function setupStatus(req, res) {
  try {
    const userCount = await prisma.user.count();
    return res.json({
      needsSetup: userCount === 0,
      configured: userCount > 0,
    });
  } catch (error) {
    console.error('Setup status error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      return res.status(409).json({
        error: 'Initial system setup is required before login.',
        needsSetup: true,
      });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Sign token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function setupAdmin(req, res) {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(400).json({ error: 'System is already configured. Setup not allowed.' });
    }

    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password and name are required.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: 'ADMIN',
      },
    });

    return res.status(201).json({
      message: 'Admin account created successfully.',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Setup admin error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function me(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      name: req.user.name,
    },
  });
}
