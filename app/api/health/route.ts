// Lightweight health endpoint. Vercel pings this; ARC-cli telemetry also uses it.

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "babel-markets",
    phase: 1,
    timestamp: new Date().toISOString(),
  });
}
