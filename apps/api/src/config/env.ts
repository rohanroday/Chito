import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  JWT_ADMIN_REFRESH_EXPIRES_IN: z.string().default('7d'),
  OTP_DEV_MODE: bool,
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Where Razorpay sends the customer back after paying (phone must be able to reach it)
  // On Render this falls back to the service's own https address (RENDER_EXTERNAL_URL is set by Render)
  PUBLIC_API_URL: z.string().optional().default(process.env.RENDER_EXTERNAL_URL ?? ''),
  IMAGEKIT_URL_ENDPOINT: z.string().optional(),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_FOLDER: z.string().default('/chito'),
  // Dev-only escape hatch for testing outside store hours. Ignored when NODE_ENV=production.
  // (There is deliberately no switch for the 3 km rule: it always applies.)
  DEV_IGNORE_STORE_HOURS: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment:', z.prettifyError(parsed.error));
  process.exit(1);
}

const e = parsed.data;
const isProd = e.NODE_ENV === 'production';

if (isProd && e.OTP_DEV_MODE) {
  console.error('❌ OTP_DEV_MODE must be false in production');
  process.exit(1);
}

export const env = {
  ...e,
  isProd,
  corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  devIgnoreStoreHours: !isProd && e.DEV_IGNORE_STORE_HOURS,
};
