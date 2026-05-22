// Circle USYC sandbox REST client. Activates when USYC_API_KEY is set in env;
// until then the parent module (lib/circle/usyc.ts) falls through to the
// deterministic local stub.
//
// Endpoint paths are placeholders that match Circle's typical developer-API
// shape (https://developers.circle.com/) and the Hashnote USYC issuance
// model. The exact URLs are confirmed once Circle issues a sandbox key
// via the hackathon access form (https://docs.circle.com/usyc). Until then,
// the wrapper still compiles and lets us flip the dashboard to "sandbox live"
// the moment Joseph drops a real key into env.

const BASE_URL_DEFAULT = "https://api-sandbox.usyc.circle.com/v1";

function getBaseUrl(): string {
  const raw = process.env.USYC_API_BASE_URL?.trim();
  if (!raw) return BASE_URL_DEFAULT;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function isUsycLive(): boolean {
  return Boolean(process.env.USYC_API_KEY);
}

interface UsycHttpError {
  status: number;
  message: string;
  body?: string;
}

async function callUsyc<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = process.env.USYC_API_KEY;
  if (!apiKey) {
    throw new Error("USYC_API_KEY missing. Stub mode should have been used instead.");
  }
  const url = `${getBaseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(
      `USYC sandbox unreachable at ${url}: ${e instanceof Error ? e.message : "network error"}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: UsycHttpError = {
      status: res.status,
      message: `Circle USYC API returned ${res.status}`,
      body: text.slice(0, 400),
    };
    throw new Error(
      `${err.message}: ${err.body || res.statusText || "no body"}. ` +
        `Confirm USYC_API_KEY + USYC_API_BASE_URL against Circle's hackathon sandbox docs.`,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Circle USYC API returned non-JSON body at ${path}`);
  }
}

export interface UsycSubscribeArgs {
  amountUsdc: string;
  walletAddress: string;
}

export interface UsycSubscribeLiveResult {
  txHash: string;
  sharesIssued: string;
  pricePerShare: string;
}

export async function usycSubscribeLive(
  args: UsycSubscribeArgs,
): Promise<UsycSubscribeLiveResult> {
  // TODO: confirm endpoint path with Circle sandbox docs once API key arrives.
  // Plausible candidates: POST /tellers/subscribe or POST /usyc/subscribe.
  const data = await callUsyc<{
    data?: {
      transactionHash?: string;
      sharesIssued?: string;
      pricePerShare?: string;
    };
  }>("POST", "/tellers/subscribe", {
    walletAddress: args.walletAddress,
    amountUsdc: args.amountUsdc,
  });
  const d = data.data ?? data;
  return {
    txHash: String((d as { transactionHash?: string }).transactionHash ?? ""),
    sharesIssued: String((d as { sharesIssued?: string }).sharesIssued ?? "0"),
    pricePerShare: String((d as { pricePerShare?: string }).pricePerShare ?? "1.0"),
  };
}

export async function usycRedeemLive(
  args: UsycSubscribeArgs,
): Promise<UsycSubscribeLiveResult> {
  // TODO: confirm endpoint path. Likely POST /tellers/redeem.
  const data = await callUsyc<{
    data?: {
      transactionHash?: string;
      sharesBurned?: string;
      pricePerShare?: string;
    };
  }>("POST", "/tellers/redeem", {
    walletAddress: args.walletAddress,
    amountUsdc: args.amountUsdc,
  });
  const d = data.data ?? data;
  return {
    txHash: String((d as { transactionHash?: string }).transactionHash ?? ""),
    sharesIssued: String((d as { sharesBurned?: string }).sharesBurned ?? "0"),
    pricePerShare: String((d as { pricePerShare?: string }).pricePerShare ?? "1.0"),
  };
}

export interface UsycBalanceLiveResult {
  shares: string;
  pricePerShare: string;
  netUsdc: string;
}

export async function usycBalanceLive(
  walletAddress: string,
): Promise<UsycBalanceLiveResult> {
  // TODO: confirm endpoint path. Likely GET /tellers/balance/{address} or /wallets/{address}/usyc.
  const data = await callUsyc<{
    data?: { shares?: string; pricePerShare?: string; netUsdc?: string };
  }>("GET", `/tellers/balance/${walletAddress}`);
  const d = data.data ?? data;
  return {
    shares: String((d as { shares?: string }).shares ?? "0"),
    pricePerShare: String((d as { pricePerShare?: string }).pricePerShare ?? "1.0"),
    netUsdc: String((d as { netUsdc?: string }).netUsdc ?? "0"),
  };
}
