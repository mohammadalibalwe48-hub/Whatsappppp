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
    <div className="flex min-h-screen">
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex flex-1 flex-col">
        <DashboardTopbar email={user.email ?? null} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
