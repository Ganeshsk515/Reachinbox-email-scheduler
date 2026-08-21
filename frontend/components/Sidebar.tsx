"use client";
import { signOut } from "next-auth/react";
import { Button } from "./ui/Button";

interface SidebarProps {
  activeTab: "scheduled" | "sent";
  scheduledCount: number;
  sentCount: number;
  onTabChange: (tab: "scheduled" | "sent") => void;
  onCompose: () => void;
  userName: string;
  userEmail: string;
}

export function Sidebar({
  activeTab,
  scheduledCount,
  sentCount,
  onTabChange,
  onCompose,
  userName,
  userEmail,
}: SidebarProps) {
  return (
    <aside className="w-72 bg-sidebar text-sidebar-foreground flex flex-col h-screen p-4">
      <div className="text-xl font-bold mb-6 tracking-tight">ReachInbox</div>

      <div className="bg-white/5 rounded-lg p-3 mb-2 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-semibold">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{userName}</div>
          <div className="text-xs text-sidebar-muted truncate">{userEmail}</div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-xs text-white/60 hover:text-white transition-colors mb-4 self-start underline underline-offset-2"
      >
        Logout
      </button>

      <Button onClick={onCompose} className="w-full mb-6">
        Compose
      </Button>

      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onTabChange("scheduled")}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            activeTab === "scheduled"
              ? "bg-white/10 text-white font-medium"
              : "text-sidebar-muted hover:bg-white/5"
          }`}
        >
          <span>Scheduled</span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{scheduledCount}</span>
        </button>

        <button
          onClick={() => onTabChange("sent")}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            activeTab === "sent"
              ? "bg-white/10 text-white font-medium"
              : "text-sidebar-muted hover:bg-white/5"
          }`}
        >
          <span>Sent</span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{sentCount}</span>
        </button>
      </nav>
    </aside>
  );
}