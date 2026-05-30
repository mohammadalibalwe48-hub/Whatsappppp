import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check if user is admin
  const { data: adminData } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isAdmin = !!adminData;

  return (
    <div className="flex min-h-screen bg-muted/10 selection:bg-primary/20 selection:text-primary relative">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-primary/5 rounded-[100%] blur-[120px] -z-10 pointer-events-none" />

      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardTopbar email={user.email ?? null} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
