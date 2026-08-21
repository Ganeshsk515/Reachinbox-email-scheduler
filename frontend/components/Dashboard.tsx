"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { EmailTable } from "@/components/EmailTable";
import { ComposeModal } from "@/components/ComposeModal";
import { fetchEmails, EmailJob } from "@/lib/apiClient";

interface DashboardProps {
  userName: string;
  userEmail: string;
  userImage?: string;
}

export function Dashboard({ userName, userEmail, userImage }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshDashboard() {
      try {
        const [activeJobs, scheduledJobs, sentJobs] = await Promise.all([
          fetchEmails(activeTab),
          fetchEmails("scheduled"),
          fetchEmails("sent"),
        ]);

        if (cancelled) return;

        setJobs(activeJobs);
        setScheduledCount(scheduledJobs.length);
        setSentCount(sentJobs.length);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void refreshDashboard();
    const interval = window.setInterval(refreshDashboard, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeTab, refreshKey]);

  function handleTabChange(tab: "scheduled" | "sent") {
    setLoading(true);
    setActiveTab(tab);
  }

  return (
    <div className="flex">
      <Sidebar
        activeTab={activeTab}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
        onTabChange={handleTabChange}
        onCompose={() => setShowCompose(true)}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
      />
      <main className="min-w-0 flex-1 bg-background px-7 py-6 sm:px-10">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex max-w-2xl flex-1 items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2.5 text-sm text-stone-600 shadow-sm">
            <span aria-hidden="true">⌕</span>
            <span>Search scheduled emails</span>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-600">
            {activeTab === "scheduled" ? "Scheduled" : "Sent"}
          </span>
        </div>
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
            setLoading(true);
            setActiveTab("scheduled");
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
