import nodemailer from 'nodemailer';

import { env, hasSmtpCredentials } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Send Payslips (rule W8), guardrail 10.8.
 *
 * With no SMTP_USER configured the mailer never touches the network: it
 * resolves as if the send succeeded so the whole workflow — including the
 * payrun's payslipsSentAt timestamp and the per-recipient result list —
 * stays demoable with no internet connection. Never logs a salary figure or
 * an email address; every log line names the employeeId instead.
 */

const SEND_CONCURRENCY = 3;

export interface PayslipMailTarget {
  payslipId: string;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  number: string;
  periodLabel: string;
}

export interface SendResult {
  payslipId: string;
  employeeId: string;
  success: boolean;
  error?: string;
}

type Attachment = { filename: string; content: Buffer } | undefined;

interface Mail {
  to: string;
  subject: string;
  text: string;
  attachment: Attachment;
}

async function deliver(mail: Mail): Promise<void> {
  if (!hasSmtpCredentials) {
    // Console transport: logs and succeeds, never touching the network.
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.attachment === undefined
      ? {}
      : { attachments: [{ filename: mail.attachment.filename, content: mail.attachment.content }] }),
  });
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const current = cursor;
      cursor += 1;
      const item = items[current];
      if (item === undefined) {
        return;
      }
      results[current] = await fn(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

/**
 * Sends one payslip's notification email. `buildPdf` is optional so the
 * caller can attach the actual PDF without this module depending on the PDF
 * renderer directly.
 */
export async function sendPayslipsForPayrun(
  targets: readonly PayslipMailTarget[],
  buildPdf?: (payslipId: string) => Promise<Buffer>,
): Promise<SendResult[]> {
  const redirectTo = env.MAIL_REDIRECT_TO.trim();

  return mapWithConcurrency(targets, SEND_CONCURRENCY, async (target) => {
    try {
      const attachment =
        buildPdf === undefined
          ? undefined
          : { filename: `${target.number}.pdf`, content: await buildPdf(target.payslipId) };

      await deliver({
        to: redirectTo.length > 0 ? redirectTo : target.employeeEmail,
        subject: `Your payslip for ${target.periodLabel}`,
        text: `Hi ${target.employeeName},\n\nYour payslip ${target.number} for ${target.periodLabel} is ready. Sign in to PayZ to view it, or see the attached PDF.\n\n— PayZ Payroll`,
        attachment,
      });

      logger.info(
        { employeeId: target.employeeId, transport: hasSmtpCredentials ? 'smtp' : 'console' },
        'Payslip email sent',
      );
      return { payslipId: target.payslipId, employeeId: target.employeeId, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown mail error';
      logger.warn({ employeeId: target.employeeId, err: message }, 'Payslip email failed');
      return {
        payslipId: target.payslipId,
        employeeId: target.employeeId,
        success: false,
        error: message,
      };
    }
  });
}
