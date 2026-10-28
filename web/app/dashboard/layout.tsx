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
    <div className="flex min-h-screen bg-background">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar email={user.email ?? null} isAdmin={isAdmin} />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
