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

  // Circle Modular Wallets enforces global uniqueness per project for the
  // passkey username. We use a stable per-user UUID-derived value so retries
  // and re-tests never collide. UUIDs are 36 chars with hyphens, so `babel-`
  // prefix lands at 42 chars (well within Circle's 5-50 range) and uses only
  // hex + hyphen which Circle allows.
  const username = `babel-${user.id}`;
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "Babel creator";

  return (
    <main className="auth-page">
      <header className="auth-head">
        <Link href="/" className="b-mark" style={{ fontSize: 18 }}>
          <span className="glyph">
            <i />
            <u />
          </span>
          BABEL
        </Link>
        <Link href="/dashboard">Dashboard ↗</Link>
      </header>
      <section className="auth-main">
        <PasskeySetup username={username} displayName={displayName} />
      </section>
    </main>
  );
}
