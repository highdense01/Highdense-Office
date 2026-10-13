import "server-only";
import nodemailer from "nodemailer";

/**
 * Sends mail through Gmail, authenticated either with a Google App Password (simplest) or Google OAuth2.
 * See .env.example. When neither is configured, development falls back to printing the message to the
 * server console so flows (like password reset) can be tried without a mail account; production does not.
 */
function createTransport() {
  const user = process.env.GMAIL_USER;
  if (!user) return null;

  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }

  if (process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      // Google shows app passwords with spaces; they must be removed.
      auth: { user, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
  }

  return null;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Returns true if the message was handed to the mail server (or logged, in dev). Never throws. */
export async function sendMail(input: MailInput): Promise<boolean> {
  const transport = createTransport();

  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `\n[mail] Gmail is not configured, so this e-mail was NOT sent. Printing it instead:\n` +
          `  To: ${input.to}\n  Subject: ${input.subject}\n  ${input.text.replace(/\n/g, "\n  ")}\n`,
      );
      return true;
    }
    console.error("[mail] GMAIL_USER and GMAIL_APP_PASSWORD (or OAuth2 settings) are not configured.");
    return false;
  }

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.GMAIL_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (err) {
    console.error("[mail] Failed to send e-mail:", err instanceof Error ? err.message : err);
    return false;
  }
}
