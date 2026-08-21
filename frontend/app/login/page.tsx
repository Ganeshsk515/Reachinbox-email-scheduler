import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="bg-white rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Login</h1>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full">
            Login with Google
          </Button>
        </form>
      </div>
    </div>
  );
}