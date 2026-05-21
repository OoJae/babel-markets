// Supabase service-role client. Server-only. Bypasses RLS.
// Used by route handlers and scripts that need to write to questions/traces/fills/attributions
// where RLS pins inserts to service_role (see initial schema).
//
// NEVER import this from a client component.
//
// We type the client as `any` for Phase 1 because we have not yet generated typed
// Database types from the live schema. Phase 2 swaps in a generated `Database` type via
// `npm run db:gen-types` and tightens this signature.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient<any, any, any> | null = null;

export function getSupabaseServiceClient(): SupabaseClient<any, any, any> {
  if (cached) return cached;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role operations");
  }
  cached = createClient<any, any, any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return cached;
}
