import nodemailer from "nodemailer";
import { env } from "../config/env";

interface SenderCredentials {
  smtpUser: string;
  smtpPass: string;
}

// Cache transporters per sender so we don't rebuild one on every single send.
const transporterCache = new Map<string, nodemailer.Transporter>();

function smtpHost() {
  if (!env.etherealHost) {
    throw new Error("Missing required env var: ETHEREAL_HOST");
  }
  return env.etherealHost;
}

function getTransporterForSender(credentials: SenderCredentials): nodemailer.Transporter {
  const cacheKey = credentials.smtpUser;

  if (transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey)!;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost(),
    port: env.etherealPort,
    secure: false,
    auth: {
      user: credentials.smtpUser,
      pass: credentials.smtpPass,
    },
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

export async function sendEmailAsSender(
  credentials: SenderCredentials,
  to: string,
  subject: string,
  body: string
) {
  const transporter = getTransporterForSender(credentials);

  const info = await transporter.sendMail({
    from: {
      name: "ReachInbox Scheduler",
      address: credentials.smtpUser,
    },
    to,
    subject,
    text: body,
  });

  console.log("Message sent:", info.messageId);
  console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
}

// Kept for backward compatibility with any standalone test scripts.
export async function sendTestEmail(to: string, subject: string, body: string) {
  if (!env.etherealUser || !env.etherealPass) {
    throw new Error("Missing required Ethereal credentials");
  }

  return sendEmailAsSender(
    { smtpUser: env.etherealUser, smtpPass: env.etherealPass },
    to,
    subject,
    body
  );
}
