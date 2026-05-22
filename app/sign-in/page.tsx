"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

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
        <Link href="/sign-up">No account? Create one ↗</Link>
      </header>
      <section className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <h1>
            Sign in to <em>Babel.</em>
          </h1>
          <p className="auth-tagline">Pick up where you left off.</p>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <p className="auth-foot">
            No account? <Link href="/sign-up">Create one</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
