const API_BASE = "http://localhost:4000";

export interface EmailJob {
  id: string;
  recipient_email: string;
  status: "scheduled" | "sent" | "failed";
  scheduled_for: string;
  sent_at: string | null;
  subject: string;
}

export async function fetchEmails(status: "scheduled" | "sent" | "failed"): Promise<EmailJob[]> {
  const res = await fetch(`${API_BASE}/api/emails?status=${status}`);
  if (!res.ok) throw new Error("Failed to fetch emails");
  const data = await res.json();
  return data.jobs;
}