import fs from 'fs';
import prisma from '../utils/prisma.js';
import { getOrSetCache, invalidateCache } from '../utils/cache.js';

const materialCachePrefix = 'materials:';

export async function getMaterials(_req, res) {
  try {
    const materials = await getOrSetCache(
      'materials:active',
      () => prisma.material.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),
      120_000
    );
    return res.json(materials);
  } catch (error) {
    console.error('Get materials error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function createMaterial(req, res) {
  const name = req.body?.name?.trim();
  if (!name) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Material name is required.' });
  }

  try {
    const material = await prisma.material.create({
      data: {
        name,
        image: req.file ? `/uploads/${req.file.filename}` : null,
      },
    });
    invalidateCache(materialCachePrefix);
    return res.status(201).json(material);
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error('Create material error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Material already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
