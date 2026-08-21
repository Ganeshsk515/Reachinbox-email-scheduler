import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Dashboard
      userName={session.user.name ?? "User"}
      userEmail={session.user.email ?? ""}
      userImage={session.user.image ?? undefined}
    />
  );
}
