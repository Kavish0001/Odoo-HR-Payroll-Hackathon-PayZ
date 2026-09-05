import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Environment is parsed once, at boot, and the process refuses to start if
 * anything required is missing or malformed (guardrail 10.9).
 *
 * The alternative is discovering at hour twenty that JWT_SECRET was undefined
 * and every token had been signed with the string "undefined".
 */

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/..."
// with a leading slash that fs cannot open.
loadDotenv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .startsWith('postgresql://', 'DATABASE_URL must be a PostgreSQL URL'),

  // Short secrets are trivially brute-forced; refuse rather than warn.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Mail is optional by design: with no SMTP_USER the mailer falls back to a
  // console transport so Send Payslips stays demoable offline (guardrail 10.8).
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('PayZ Payroll <no-reply@payz.local>'),
  MAIL_REDIRECT_TO: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the values.`,
    );
  }

  return parsed.data;
}

export const env: Env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** True when real SMTP credentials are present; false selects the console transport. */
export const hasSmtpCredentials = env.SMTP_USER.length > 0;
