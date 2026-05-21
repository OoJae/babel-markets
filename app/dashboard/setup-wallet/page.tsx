import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { PasskeySetup } from "@/components/passkey-setup";

export default async function SetupWalletPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const username = user.user_metadata?.full_name || user.email || "babel-user";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <PasskeySetup username={username} />
    </main>
  );
}
