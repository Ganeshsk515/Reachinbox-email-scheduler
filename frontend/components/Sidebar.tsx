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
  userImage?: string;
}

export function Sidebar({
  activeTab,
  scheduledCount,
  sentCount,
  onTabChange,
  onCompose,
  userName,
  userEmail,
  userImage,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-zinc-900 bg-sidebar p-4 text-sidebar-foreground">
      <div className="mb-6 text-2xl font-extrabold tracking-tight">ReachInbox</div>

      <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/10 p-3">
        {userImage ? (
          <img src={userImage} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{userName}</div>
          <div className="truncate text-xs text-sidebar-muted">{userEmail}</div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mb-4 self-start text-xs text-sidebar-muted underline underline-offset-2 transition-colors hover:text-white"
      >
        Logout
      </button>

      <Button onClick={onCompose} className="mb-6 w-full bg-primary text-white hover:bg-primary-hover">
        Compose
      </Button>

      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onTabChange("scheduled")}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
            activeTab === "scheduled"
              ? "bg-white/15 text-white font-medium"
              : "text-sidebar-muted hover:bg-white/5"
          }`}
        >
          <span>Scheduled</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{scheduledCount}</span>
        </button>

        <button
          onClick={() => onTabChange("sent")}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
            activeTab === "sent"
              ? "bg-white/15 text-white font-medium"
              : "text-sidebar-muted hover:bg-white/5"
          }`}
        >
          <span>Sent</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{sentCount}</span>
        </button>
      </nav>
    </aside>
  );
}
