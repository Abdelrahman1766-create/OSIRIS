import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Router, type RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { config } from './config.js';
import { prisma } from './db.js';
import { HttpError } from './http.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { id: string; role: Role };
  }
}

const credentials = z.object({ email: z.string().email().max(320).transform((s) => s.toLowerCase().trim()), password: z.string().min(8).max(128) });
const registerSchema = credentials.extend({ name: z.string().trim().min(2).max(100) });
const supplierRegisterSchema = registerSchema.extend({
  shopName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  contactEmail: z.string().email().max(320).optional(),
  contactPhone: z.string().trim().max(40).optional(),
});

function tokenFor(user: { id: string; role: Role }) {
  return jwt.sign({ role: user.role }, config.JWT_SECRET, { subject: user.id, expiresIn: '7d', issuer: 'osiris' });
}

const publicUser = (user: { id: string; name: string; email: string; role: Role; createdAt: Date }) => ({
  id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt,
});

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.header('authorization') ?? '');
  if (!match?.[1]) return next(new HttpError(401, 'Authentication required', 'UNAUTHORIZED'));
  let subject: string;
  try {
    const payload = jwt.verify(match[1], config.JWT_SECRET, { issuer: ['osiris', 'royal-essence'] });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token');
    subject = payload.sub;
  } catch {
    return next(new HttpError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
  const user = await prisma.user.findUnique({ where: { id: subject }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive) return next(new HttpError(401, 'Account unavailable', 'UNAUTHORIZED'));
  req.auth = { id: user.id, role: user.role };
  next();
};

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.auth) return next(new HttpError(401, 'Authentication required', 'UNAUTHORIZED'));
  if (!roles.includes(req.auth.role)) return next(new HttpError(403, 'Insufficient permissions', 'FORBIDDEN'));
  next();
};

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'shop';
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const body = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({ data: { name: body.name, email: body.email, passwordHash } });
  res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
});

authRouter.post('/register-supplier', async (req, res) => {
  const body = supplierRegisterSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      name: body.name, email: body.email, passwordHash, role: Role.SUPPLIER,
      supplier: { create: {
        shopName: body.shopName,
        slug: `${slugify(body.shopName)}-${randomUUID().slice(0, 8)}`,
        description: body.description,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
      } },
    },
  });
  res.status(201).json({ token: tokenFor(user), user: publicUser(user), approvalStatus: 'PENDING' });
});

authRouter.post('/login', async (req, res) => {
  const body = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true, supplier: { select: { id: true, shopName: true, slug: true, isApproved: true } } },
  });
  res.json(user);
});
