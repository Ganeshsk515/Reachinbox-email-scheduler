"use client";
import { useState } from "react";
import Papa from "papaparse";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

const SENDER_ID = "cd07bb53-c67e-4e31-8975-e3ba6d0f078c";
const API_BASE = "http://localhost:4000";

interface ComposeModalProps {
  onClose: () => void;
  onScheduled: () => void;
}

export function ComposeModal({ onClose, onScheduled }: ComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const raw = (result.data as string[][])
          .flat()
          .map((v) => v.trim())
          .filter((v) => v.includes("@"));

        // De-duplicate case-insensitively while preserving first-seen casing
        const seen = new Set<string>();
        const emails: string[] = [];
        for (const email of raw) {
          const lower = email.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            emails.push(email);
          }
        }

        if (emails.length === 0) {
          setError("No valid email addresses found in that file.");
        } else {
          setError("");
        }

        setRecipients(emails);
      },
      error: () => {
        setError("Couldn't parse that CSV file. Please check the format.");
      },
    });

    // Allow re-uploading a file with the same name after a fix
    e.target.value = "";
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email));
  }

  async function handleSubmit() {
    setError("");

    if (!subject || !body || recipients.length === 0) {
      setError("Subject, body, and at least one recipient are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          senderId: SENDER_ID,
          delayBetweenMs,
          maxEmailsPerHour,
          recipients,
        }),
      });

      if (!res.ok) throw new Error("Failed to schedule campaign");

      onScheduled();
      onClose();
    } catch (err) {
      setError("Something went wrong scheduling this campaign.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Compose New Email</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Recipients (CSV upload) — {recipients.length} detected
            </label>
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="text-sm" />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.slice(0, 6).map((email, index) => (
                  <span
                    key={`${email}-${index}`}
                    className="bg-primary-light text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1"
                  >
                    {email}
                    <button onClick={() => removeRecipient(email)} className="hover:text-primary-hover">✕</button>
                  </span>
                ))}
                {recipients.length > 6 && (
                  <span className="text-xs text-muted px-2 py-1">+{recipients.length - 6} more</span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium block mb-1">Delay between emails (ms)</label>
              <Input
                type="number"
                value={delayBetweenMs}
                onChange={(e) => setDelayBetweenMs(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium block mb-1">Hourly limit</label>
              <Input
                type="number"
                value={maxEmailsPerHour}
                onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
              />
            </div>
          </div>

          {error && <p className="text-status-failed text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}