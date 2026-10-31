import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardMobileNav, DashboardSidebar } from "@/components/dashboard/sidebar";
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
    <div className="workspace-backdrop flex min-h-dvh bg-background">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar email={user.email ?? null} isAdmin={isAdmin} />
        <main id="main-content" tabIndex={-1} className="mobile-safe-bottom min-w-0 flex-1 overflow-x-clip px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px] animate-fade-in">{children}</div>
        </main>
        <DashboardMobileNav isAdmin={isAdmin} />
      </div>
    </div>
  );
}
