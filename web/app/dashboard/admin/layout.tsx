import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/dashboard/admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: adminData } = await supabase
    .from("admins")
    .select("id,role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (!adminData) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin Console</h1>
          <p className="text-xs text-muted-foreground">
            Full access to every user, key, log, and session on this OtpWave instance.
          </p>
        </div>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
