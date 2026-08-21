"use client";

import { useState } from "react";
import Papa from "papaparse";
import { apiUrl } from "@/lib/apiClient";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useToast } from "./ui/Toast";

const SENDER_ID = "cd07bb53-c67e-4e31-8975-e3ba6d0f078c";

interface ComposeModalProps {
  onClose: () => void;
  onScheduled: () => void;
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ComposeModal({ onClose, onScheduled }: ComposeModalProps) {
  const { showToast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(100);
  const [startTime, setStartTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function addRecipients(values: string[]) {
    const valid = values.map((value) => value.trim()).filter((value) => value.includes("@"));
    setRecipients((current) => [...new Set([...current, ...valid])]);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (result) => addRecipients((result.data as string[][]).flat()),
    });
  }

  function addTypedRecipient() {
    addRecipients(recipientInput.split(","));
    setRecipientInput("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) => current.filter((recipient) => recipient !== email));
  }

  async function handleSubmit() {
    if (!subject || !body || recipients.length === 0 || !startTime) {
      showToast("Subject, body, recipients, and a start time are required.", "error");
      return;
    }

    const scheduledAt = new Date(startTime);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      showToast("Choose a start time in the future.", "error");
      return;
    }

    setSubmitting(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(apiUrl("/api/campaigns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          subject,
          body,
          senderId: SENDER_ID,
          delayBetweenMs,
          maxEmailsPerHour,
          startTime: scheduledAt.toISOString(),
          recipients,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const detail = data?.details
          ? Object.values(data.details).flat().join(", ")
          : data?.error ?? "Failed to schedule campaign.";
        showToast(detail, "error");
        return;
      }

      showToast(`Scheduled ${data.emailsScheduled} email(s) successfully.`, "success");
      onScheduled();
      onClose();
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "Scheduling timed out. Check that the API and Redis are running."
        : "Something went wrong scheduling this campaign.";
      showToast(message, "error");
      console.error(error);
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-foreground">
      <header className="flex items-center justify-between border-b border-border px-7 py-5 sm:px-10">
        <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-foreground" aria-label="Close compose">←</button>
        <h2 className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold">Compose New Email</h2>
        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Scheduling..." : "Send Later"}</Button>
      </header>

      <div className="mx-auto max-w-5xl px-7 py-8 sm:px-12">
        <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center border-b border-border py-3 text-sm">
          <label>From</label>
          <div className="w-fit rounded-lg bg-orange-50 px-3 py-2">ReachInbox Scheduler</div>
        </div>

        <div className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-border py-3 text-sm">
          <label className="pt-2">To</label>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {recipients.map((email) => (
                <span key={email} className="rounded-full bg-primary-light px-2 py-1 text-xs text-primary">
                  {email}
                  <button onClick={() => removeRecipient(email)} className="ml-1 hover:text-primary-hover" aria-label={`Remove ${email}`}>×</button>
                </span>
              ))}
              <input
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addTypedRecipient())}
                onBlur={addTypedRecipient}
                placeholder="recipient@example.com"
                className="min-w-48 flex-1 border-0 py-2 text-sm outline-none placeholder:text-slate-400"
              />
              <label className="cursor-pointer text-sm font-medium text-primary hover:text-primary-hover">
                Upload list
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="sr-only" />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">{recipients.length} recipient{recipients.length === 1 ? "" : "s"} detected</p>
          </div>
        </div>

        <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center border-b border-border py-3 text-sm">
          <label htmlFor="subject">Subject</label>
          <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="border-0 px-0 shadow-none focus:ring-0" />
        </div>

        <div className="ml-[120px] flex flex-wrap gap-5 py-5">
          <label className="text-sm">Start time
            <Input type="datetime-local" min={localDateTimeValue()} value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1" />
          </label>
          <label className="text-sm">Delay between emails (ms)
            <Input type="number" min="1" value={delayBetweenMs} onChange={(event) => setDelayBetweenMs(Number(event.target.value))} className="mt-1 w-44" />
          </label>
          <label className="text-sm">Hourly limit
            <Input type="number" min="1" value={maxEmailsPerHour} onChange={(event) => setMaxEmailsPerHour(Number(event.target.value))} className="mt-1 w-36" />
          </label>
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your email..."
          rows={14}
          className="w-full rounded-xl bg-orange-50/70 px-5 py-4 text-sm outline-none ring-1 ring-transparent placeholder:text-muted focus:ring-primary"
        />
      </div>
    </div>
  );
}
