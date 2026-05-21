// Babel Markets, edge middleware.
// Refreshes the Supabase session AND geo-gates US persons out of trading endpoints.
// Polymarket prohibits US-person trading via its UI, API, or agents built by persons
// in restricted jurisdictions. We enforce that at the edge.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const TRADING_PATHS = ["/api/post-market", "/api/ingest", "/dashboard"];
const US_COUNTRY_CODES = new Set(["US"]);

function isTradingPath(pathname: string): boolean {
  return TRADING_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Geo-gate US persons out of trading paths.
  // Vercel sets x-vercel-ip-country; Cloudflare uses cf-ipcountry. Cookie wins for self-attest.
  const selfAttestNonUs = request.cookies.get("babel_not_us")?.value === "1";
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    "";

  if (isTradingPath(pathname) && US_COUNTRY_CODES.has(country) && !selfAttestNonUs) {
    return NextResponse.redirect(new URL("/geo-gate", request.url));
  }

  // Refresh the Supabase session so server components have a fresh user.
  let response = NextResponse.next({ request: { headers: request.headers } });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  } catch (e) {
    // If Supabase env vars are missing during local dev, do not crash the request.
    // The page itself will render a setup banner.
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except static assets, images, and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
