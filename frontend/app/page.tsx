"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { EmailTable } from "@/components/EmailTable";
import { ComposeModal } from "@/components/ComposeModal";
import { fetchEmails, EmailJob } from "@/lib/apiClient";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchEmails(activeTab)
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, refreshKey]);

  useEffect(() => {
    fetchEmails("scheduled")
      .then((jobs) => setScheduledCount(jobs.length))
      .catch(console.error);
    fetchEmails("sent")
      .then((jobs) => setSentCount(jobs.length))
      .catch(console.error);
  }, [jobs]);

  return (
    <div className="flex">
      <Sidebar
        activeTab={activeTab}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
        onTabChange={setActiveTab}
        onCompose={() => setShowCompose(true)}
        userName="Test User"
        userEmail="test@example.com"
      />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold mb-6 capitalize">
          {activeTab} Emails
        </h1>
        <EmailTable
          jobs={jobs}
          loading={loading}
          emptyMessage={`No ${activeTab} emails yet.`}
        />
      </main>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onScheduled={() => {
            setActiveTab("scheduled");
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}