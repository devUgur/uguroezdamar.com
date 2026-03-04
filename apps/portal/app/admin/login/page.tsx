import { LoginForm } from "@/src/features/admin/ui/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl border shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Admin Login</h1>
          <p className="text-muted-foreground text-sm">
            Enter your admin credentials to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
