import nodemailer from 'nodemailer';

import { env, hasSmtpCredentials } from '../config/env.js';

/**
 * Checks the SMTP configuration before a demo, without sending anything.
 *
 *   npm run mail:check              -- opens and authenticates a connection
 *   npm run mail:check -- --send    -- also sends one small test message
 *
 * Worth having as its own command because the alternative is discovering a
 * wrong app password by clicking Send Payslips in front of an audience and
 * watching 122 rows fail. Never prints the password, and prints the address
 * only as far as its domain.
 */

/** `someone@gmail.com` -> `s***@gmail.com`. */
function maskAddress(address: string): string {
  const at = address.indexOf('@');
  if (at <= 0) {
    return '***';
  }
  return `${address.slice(0, 1)}***${address.slice(at)}`;
}

async function main(): Promise<void> {
  if (!hasSmtpCredentials) {
    console.log(
      'SMTP_USER is empty, so PayZ is on the console transport: Send Payslips\n' +
        'will succeed without touching the network. Fill SMTP_USER and\n' +
        'SMTP_PASS in .env to send for real.',
    );
    return;
  }

  if (env.SMTP_PASS.trim().length === 0) {
    console.error(
      'SMTP_USER is set but SMTP_PASS is empty. Gmail needs a 16-character\n' +
        'App Password (not the account password), spaces removed.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Host      ${env.SMTP_HOST}:${String(env.SMTP_PORT)}`);
  console.log(`User      ${maskAddress(env.SMTP_USER)}`);
  console.log(
    `Redirect  ${
      env.MAIL_REDIRECT_TO.trim().length > 0
        ? `${maskAddress(env.MAIL_REDIRECT_TO.trim())} (every payslip goes here)`
        : 'none - payslips go to each employee’s real work email'
    }`,
  );

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  try {
    await transporter.verify();
    console.log('\nConnection OK - credentials accepted.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nConnection FAILED: ${message}`);
    console.error(
      '\nUsual causes:\n' +
        '  - SMTP_PASS is the account password, not an App Password\n' +
        '  - 2-Step Verification is off, so App Passwords cannot be created\n' +
        '  - spaces were left in the 16-character password\n' +
        '  - a firewall is blocking outbound port 587',
    );
    process.exitCode = 1;
    transporter.close();
    return;
  }

  if (process.argv.includes('--send')) {
    const to = (
      env.MAIL_REDIRECT_TO.trim().length > 0
        ? env.MAIL_REDIRECT_TO
        : env.SMTP_USER
    ).trim();

    await transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: 'PayZ SMTP test',
      text:
        'This is a test message from PayZ.\n\n' +
        'If you are reading it, Send Payslips will deliver real payslips ' +
        'with their PDF attached.',
    });
    console.log(`Test message sent to ${maskAddress(to)}.`);
  } else {
    console.log('Run with -- --send to also send one test message.');
  }

  transporter.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
