import nodemailer from "nodemailer";
import {env} from "../config/env";

export const transporter = nodemailer.createTransport({
    host: env.etherealHost,
    port: env.etherealPort,
    secure: false, // Ethereal uses STARTTLS on 587, not implicit TLS
    auth: {
        user: env.etherealUser,
        pass: env.etherealPass,
    },
});

export async function sendTestEmail(to: string, subject: string, body: string) {
  const info = await transporter.sendMail({
    from: {
      name: "ReachInbox Scheduler",
      address: env.etherealUser,
    },
    to,
    subject,
    text: body,
  });

    console.log("Message sent:", info.messageId);
    console.log("previous URL:", nodemailer.getTestMessageUrl(info));
}
