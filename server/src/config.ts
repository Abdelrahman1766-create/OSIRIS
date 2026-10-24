import 'dotenv/config';
import { z } from 'zod';

const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional());

const parsed = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  CLIENT_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),
  AWS_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: optionalUrl,
  S3_PUBLIC_BASE_URL: optionalUrl,
  PUBLIC_API_ORIGIN: optionalUrl,
}).safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server environment: ${parsed.error.message}`);
}

export const config = parsed.data;
export const allowedOrigins = config.CLIENT_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
