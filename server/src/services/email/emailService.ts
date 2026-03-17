import nodemailer from 'nodemailer';
import { config } from '../../config/index';

const isLocalSmtp = !config.smtp.user;

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  // Local fake SMTP servers (FakeSMTP, Mailpit, etc.) have no TLS — skip the handshake entirely
  ignoreTLS: isLocalSmtp,
  tls: isLocalSmtp ? { rejectUnauthorized: false } : undefined,
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: 'Your Simple UI login code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="margin:0 0 8px">Your login code</h2>
        <p style="color:#666;margin:0 0 24px">Enter this code to complete your login. It expires in 10 minutes.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;font-size:36px;letter-spacing:8px;font-weight:bold;font-family:monospace">
          ${code}
        </div>
        <p style="color:#999;font-size:12px;margin:24px 0 0">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendDeviceRegistrationEmail(
  to: string,
  deviceName: string,
  confirmUrl: string,
): Promise<void> {
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: 'Confirm new device — Simple UI',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="margin:0 0 8px">New device detected</h2>
        <p style="color:#666;margin:0 0 24px">
          A login was attempted from a new device: <strong>${deviceName}</strong>.<br>
          Click the button below to register this device. This link expires in 24 hours.
        </p>
        <a href="${confirmUrl}" style="display:inline-block;background:#5c6bc0;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold">
          Register this device
        </a>
        <p style="color:#999;font-size:12px;margin:24px 0 0">
          If you didn't attempt this login, ignore this email — your account is safe.
        </p>
      </div>
    `,
  });
}
