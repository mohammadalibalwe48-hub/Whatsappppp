import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  // Check if user is admin by querying the admins table
  const { data: adminData } = await supabase
    .from("admins")
    .select("id,role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .single();

  if (!adminData) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}