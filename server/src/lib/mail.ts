// Outbound email via SMTP (nodemailer). Plain text only — nothing
// user-supplied is ever rendered as HTML. If SMTP isn't configured the
// message is logged instead, so nothing breaks in development.

import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

let transporter: Transporter | null = null;
if (config.mail.host) {
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined
  });
}

// Header injection guard for anything that lands in a header field.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 200);

export async function sendMail(to: string, subject: string, text: string, replyTo?: string): Promise<void> {
  if (!to) return;
  if (!transporter) {
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({
      from: config.mail.from,
      to,
      subject: oneLine(subject),
      text,
      ...(replyTo ? { replyTo: oneLine(replyTo) } : {})
    });
  } catch (err) {
    console.error('[mail] send failed:', (err as Error).message);
  }
}

export const money = (cents: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: config.currency }).format(cents / 100);
