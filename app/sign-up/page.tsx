"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [ackNotUs, setAckNotUs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ackNotUs) {
      setError("You must confirm you are not a US person to sign up.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard/setup-wallet");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <header className="auth-head">
        <Link href="/" className="mark">
          babel/markets
        </Link>
        <Link href="/sign-in">Have an account? Sign in ↗</Link>
      </header>
      <section className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <h1>
            Create your <em>Babel account.</em>
          </h1>
          <p className="auth-tagline">A passkey wallet awaits on the next page.</p>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <label htmlFor="signup-name">Name</label>
            <input
              id="signup-name"
              className="auth-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password (8+ characters)</label>
            <input
              id="signup-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={ackNotUs}
              onChange={(e) => setAckNotUs(e.target.checked)}
            />
            <span>
              I confirm I am not a US person and I understand that Babel posts to
              Polymarket on testnet. I have read the compliance notice.
            </span>
          </label>
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Creating..." : "Create account"}
          </button>
          <p className="auth-foot">
            Have an account? <Link href="/sign-in">Sign in</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
