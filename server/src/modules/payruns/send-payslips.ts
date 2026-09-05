import { formatINR } from '@payz/shared';
import nodemailer, { type Transporter } from 'nodemailer';

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
  payslipId: number;
  employeeId: number;
  employeeEmail: string;
  employeeName: string;
  number: string;
  periodLabel: string;
  netAmount: number;
}

export interface SendResult {
  payslipId: number;
  employeeId: number;
  success: boolean;
  error?: string;
}

type Attachment = { filename: string; content: Buffer } | undefined;

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachment: Attachment;
}

/**
 * One pooled connection set for the whole payrun.
 *
 * A payrun sends as many emails as it has payslips. Building a transporter
 * per message opens, authenticates and tears down a TLS connection every
 * time, which Gmail throttles aggressively and which turns a 120-payslip run
 * into 120 handshakes. Pooling keeps a small number of authenticated
 * connections open and reuses them.
 */
let cached: Transporter | null = null;

function transporter(): Transporter {
  cached ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is implicit TLS; 587 negotiates STARTTLS after connecting.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    pool: true,
    maxConnections: SEND_CONCURRENCY,
    maxMessages: 50,
  });
  return cached;
}

/**
 * Confirms the credentials once per run before any message goes out.
 *
 * Without this, a wrong app password produces one identical authentication
 * failure per payslip and the officer has to read 120 rows to learn one
 * fact. Verified once, the run fails fast with a single clear reason.
 */
async function verifyOnce(): Promise<void> {
  await transporter().verify();
}

async function deliver(mail: Mail): Promise<void> {
  if (!hasSmtpCredentials) {
    // Console transport: logs and succeeds, never touching the network.
    return;
  }

  await transporter().sendMail({
    from: env.MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(mail.attachment === undefined
      ? {}
      : {
          attachments: [
            {
              filename: mail.attachment.filename,
              content: mail.attachment.content,
              contentType: 'application/pdf',
            },
          ],
        }),
  });
}

/**
 * Anything interpolated into the HTML body comes from the database, and an
 * employee's own name is the one field a person controls. Escaping it keeps
 * a name containing a bracket from breaking the markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function plainBody(target: PayslipMailTarget): string {
  return [
    `Hi ${target.employeeName},`,
    '',
    `Your payslip for ${target.periodLabel} is attached as a PDF.`,
    '',
    `Payslip number: ${target.number}`,
    `Net pay: ${formatINR(target.netAmount)}`,
    '',
    'Sign in to PayZ to see the full breakdown of earnings and deductions.',
    '',
    'This is an automated message — please do not reply. If anything looks',
    'wrong, contact your HR team.',
    '',
    '— PayZ Payroll',
  ].join('\n');
}

/**
 * Table-based markup with inline styles, because mail clients strip <style>
 * blocks and Outlook still ignores most of flexbox and grid. The plain-text
 * alternative above carries the same facts for anyone reading in a client
 * that shows no HTML at all.
 */
export function htmlBody(target: PayslipMailTarget): string {
  const name = escapeHtml(target.employeeName);
  const period = escapeHtml(target.periodLabel);
  const number = escapeHtml(target.number);
  const net = escapeHtml(formatINR(target.netAmount));

  // The charset is declared even though nodemailer labels the MIME part
  // utf-8: some clients trust the document over the part header, and without
  // it the rupee symbol arrives as mojibake.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your PayZ payslip</title>
</head>
<body style="margin:0;padding:24px;background:#F5F5F5;font-family:Helvetica,Arial,sans-serif;color:#16181C;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #C9CED3;">
    <tr>
      <td style="padding:20px 24px 0 24px;">
        <div style="font-size:18px;font-weight:bold;letter-spacing:-0.4px;">PayZ</div>
        <div style="height:3px;width:48px;background:#FF0000;margin-top:10px;"></div>
        <div style="height:3px;background:#BBD5DA;"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 0 24px;font-size:14px;line-height:1.5;">
        <p style="margin:0 0 12px 0;">Hi ${name},</p>
        <p style="margin:0 0 16px 0;">Your payslip for <strong>${period}</strong> is attached to this email as a PDF.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#DFF1F1;border:1px solid #16181C;">
          <tr>
            <td style="padding:12px 14px;font-size:11px;letter-spacing:1.3px;color:#6B7076;">NET PAY</td>
            <td style="padding:12px 14px;text-align:right;font-size:20px;font-weight:bold;">${net}</td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #C9CED3;border-top:0;">
          <tr>
            <td style="padding:10px 14px;font-size:11px;letter-spacing:1px;color:#9BA1A7;">PAYSLIP NUMBER</td>
            <td style="padding:10px 14px;text-align:right;font-size:13px;">${number}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px 24px 24px;font-size:12px;line-height:1.5;color:#6B7076;">
        <p style="margin:0 0 10px 0;">Sign in to PayZ to see the full breakdown of earnings and deductions.</p>
        <p style="margin:0;">This is an automated message — please do not reply. If anything looks wrong, contact your HR team.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
 * Sends every payslip's email. `buildPdf` is optional so the caller can
 * attach the actual PDF without this module depending on the PDF renderer
 * directly.
 *
 * A failure is recorded per recipient rather than thrown, because one bad
 * address must not stop the other 119 payslips going out; the caller marks
 * only the successes as sent, so a retry picks up exactly what is left.
 */
export async function sendPayslipsForPayrun(
  targets: readonly PayslipMailTarget[],
  buildPdf?: (payslipId: number) => Promise<Buffer>,
): Promise<SendResult[]> {
  const redirectTo = env.MAIL_REDIRECT_TO.trim();

  if (hasSmtpCredentials && targets.length > 0) {
    try {
      await verifyOnce();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      logger.error({ err: message }, 'SMTP connection could not be verified');
      // A connection that cannot authenticate will fail identically for
      // every recipient; report it once against all of them and send none.
      return targets.map((target) => ({
        payslipId: target.payslipId,
        employeeId: target.employeeId,
        success: false,
        error: `SMTP unavailable: ${message}`,
      }));
    }
  }

  return mapWithConcurrency(targets, SEND_CONCURRENCY, async (target) => {
    try {
      const attachment =
        buildPdf === undefined
          ? undefined
          : {
              filename: `${target.number.replace(/[^\w.-]+/g, '-')}.pdf`,
              content: await buildPdf(target.payslipId),
            };

      await deliver({
        to: redirectTo.length > 0 ? redirectTo : target.employeeEmail,
        subject: `Your payslip for ${target.periodLabel} — ${target.number}`,
        text: plainBody(target),
        html: htmlBody(target),
        attachment,
      });

      logger.info(
        {
          employeeId: target.employeeId,
          transport: hasSmtpCredentials ? 'smtp' : 'console',
          attached: attachment !== undefined,
        },
        'Payslip email sent',
      );
      return {
        payslipId: target.payslipId,
        employeeId: target.employeeId,
        success: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      logger.warn(
        { employeeId: target.employeeId, err: message },
        'Payslip email failed',
      );
      return {
        payslipId: target.payslipId,
        employeeId: target.employeeId,
        success: false,
        error: message,
      };
    }
  });
}

/** Closes the pooled connections. Called on shutdown; safe to call twice. */
export function closeMailTransport(): void {
  cached?.close();
  cached = null;
}
