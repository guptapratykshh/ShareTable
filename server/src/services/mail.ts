import nodemailer from "nodemailer";
import { config, reloadSmtpEnv } from "../config.js";
import { AppError } from "../utils.js";

export type SentMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  verifyUrl?: string;
};

export const sentMail: SentMail[] = [];

let transporter: nodemailer.Transporter | undefined;
let transporterKey = "";

function smtpErrorMessage(err: unknown) {
  const e = err as { code?: string; command?: string; response?: string; message?: string };
  const text = `${e.code ?? ""} ${e.command ?? ""} ${e.response ?? ""} ${e.message ?? ""}`;
  if (/EAUTH|Invalid login|Username and Password not accepted|Application-specific password|5\.7\./i.test(text)) {
    return "Gmail rejected the SMTP login. Create a 16-character App Password at myaccount.google.com/apppasswords and put that in SMTP_PASS — not your Gmail account password.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ESOCKET/i.test(text)) {
    return "Could not reach the mail server. Check SMTP_HOST and SMTP_PORT.";
  }
  return "Could not send the verification email. Check the SMTP settings and try again.";
}

function getTransporter() {
  reloadSmtpEnv();
  if (!config.smtpConfigured) return undefined;
  const key = `${config.smtpHost}|${config.smtpPort}|${config.smtpUser}|${config.smtpPass}|${config.mailFrom}`;
  if (!transporter || transporterKey !== key) {
    transporterKey = key;
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      requireTLS: config.smtpPort === 587,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return transporter;
}

export function resetSentMail() {
  sentMail.length = 0;
}

export async function sendMail(message: SentMail) {
  sentMail.push(message);
  if (config.nodeEnv === "test") return;

  const mailer = getTransporter();
  if (!mailer) {
    console.info(`[mail] SMTP not configured. ${message.subject} → ${message.to}`);
    if (message.verifyUrl) console.info(`[mail] Verify URL: ${message.verifyUrl}`);
    throw new AppError("Email sending is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env, then resend.", 503);
  }

  try {
    await mailer.sendMail({
      from: config.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    console.info(`[mail] Sent ${message.subject} → ${message.to}`);
  } catch (err) {
    console.error("[mail] Send failed", err);
    throw new AppError(smtpErrorMessage(err), 502);
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const subject = "Confirm your ShareTable email";
  const text = [
    "Confirm this email to finish creating your ShareTable account, then log in.",
    "",
    verifyUrl,
    "",
    "This link expires in 24 hours. If you did not create an account, you can ignore this message.",
  ].join("\n");
  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; color: #111; line-height: 1.55;">
      <p style="letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; color: #6b7280;">ShareTable</p>
      <h1 style="font-size: 28px; font-weight: 600; margin: 8px 0 12px;">Confirm your email</h1>
      <p style="color: #4b5563; margin: 0 0 20px;">Tap the button to confirm this email, then log in to ShareTable.</p>
      <p style="margin: 0 0 24px;">
        <a href="${verifyUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; border-radius: 999px; padding: 12px 22px; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600;">Verify email</a>
      </p>
      <p style="color: #6b7280; font-size: 13px; margin: 0;">This link expires in 24 hours. If you did not create an account, ignore this message.</p>
    </div>
  `;
  await sendMail({ to, subject, text, html, verifyUrl });
}
