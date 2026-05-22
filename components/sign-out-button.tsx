"use client";

// Tiny sign-out link for the dashboard header. Calls supabase.auth.signOut()
// then routes back to /. Styled as a small text link to match the wallet meta.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        background: "transparent",
        border: "none",
        cursor: pending ? "wait" : "pointer",
        font: "inherit",
        color: "inherit",
        opacity: pending ? 0.5 : 0.7,
        padding: 0,
        textDecoration: "underline",
        letterSpacing: "inherit",
        textTransform: "inherit",
      }}
    >
      {pending ? "Signing out..." : "Sign out ↗"}
    </button>
  );
}
