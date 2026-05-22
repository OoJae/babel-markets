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
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ackNotUs) {
      setError("You must confirm you are not a US person to sign up.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If Supabase returned a session immediately, email confirmation is off
    // for this project and we can route into the wallet flow. Otherwise the
    // user needs to confirm via the email link.
    if (data.session) {
      router.push("/dashboard/setup-wallet");
      router.refresh();
      return;
    }
    setSentEmail(email);
  }

  async function resend() {
    if (!sentEmail) return;
    setResending(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resend({
      type: "signup",
      email: sentEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setResending(false);
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
        <Link href="/sign-in">Have an account? Sign in ↗</Link>
      </header>
      <section className="auth-main">
        {sentEmail ? (
          <div className="auth-card">
            <h1>
              Check your <em>inbox.</em>
            </h1>
            <p className="auth-tagline">
              We sent a confirmation link to <strong>{sentEmail}</strong>. Click
              it to finish creating your Babel account and set up your passkey
              wallet.
            </p>
            <div className="auth-success">
              The link expires in 24 hours. If you do not see the email, check your
              spam folder.
            </div>
            <button
              type="button"
              className="brand-pill outline"
              onClick={resend}
              disabled={resending}
              style={{ width: "100%" }}
            >
              {resending ? "Resending..." : "Resend confirmation email"}
            </button>
            <p className="auth-foot">
              Wrong email? <Link href="/sign-up">Try again</Link>
            </p>
          </div>
        ) : (
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
        )}
      </section>
    </main>
  );
}
