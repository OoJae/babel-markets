import { redirect } from "next/navigation";
import Link from "next/link";
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
    <main className="auth-page">
      <header className="auth-head">
        <Link href="/" className="mark">
          babel/markets
        </Link>
        <Link href="/dashboard">Dashboard ↗</Link>
      </header>
      <section className="auth-main">
        <PasskeySetup username={username} />
      </section>
    </main>
  );
}
