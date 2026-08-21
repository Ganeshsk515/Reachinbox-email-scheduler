"use client";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");

  return (
    <div className="flex">
      <Sidebar
        activeTab={activeTab}
        scheduledCount={12}
        sentCount={785}
        onTabChange={setActiveTab}
        onCompose={() => alert("compose clicked")}
        userName="Test User"
        userEmail="test@example.com"
      />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold">Active tab: {activeTab}</h1>
      </main>
    </div>
  );
}