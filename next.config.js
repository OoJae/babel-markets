// Babel Markets, Next.js config. Validates required env vars at boot so misconfigured
// deploys fail fast rather than at runtime on first request.

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "NEXT_PUBLIC_CIRCLE_CLIENT_URL",
  "NEXT_PUBLIC_CIRCLE_CLIENT_KEY",
  "ANTHROPIC_API_KEY",
];

// Skip env validation during lint, typecheck, and standalone scripts.
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.NEXT_PHASE === "phase-production-build";

if (!skipValidation) {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Babel Markets is missing required env vars: ${missing.join(", ")}. See SETUP.md.`,
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Keep existing externals and add Xenova/ONNX for the Vercel embedding step
  serverExternalPackages: [
    "pdf-parse", 
    "langfuse-node", 
    "@irys/upload",
    "@xenova/transformers",
    "onnxruntime-node"
  ],
};

module.exports = nextConfig;