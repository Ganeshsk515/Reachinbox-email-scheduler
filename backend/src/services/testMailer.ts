import { sendTestEmail } from "./mailer";

sendTestEmail(
  "someone@example.com",
  "Test email from ReachInbox scheduler",
  "This is a standalone test, outside the queue."
);