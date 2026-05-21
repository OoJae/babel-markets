// Typed view of the environment Babel Markets reads.
// Keep this in sync with .env.example and next.config.js validation.

declare namespace NodeJS {
  interface ProcessEnv {
    // Public app URL
    NEXT_PUBLIC_VERCEL_URL: string;

    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;

    // Circle developer platform
    CIRCLE_API_KEY: string;
    CIRCLE_ENTITY_SECRET: string;
    NEXT_PUBLIC_CIRCLE_CLIENT_URL: string;
    NEXT_PUBLIC_CIRCLE_CLIENT_KEY: string;

    // Agent inference
    ANTHROPIC_API_KEY: string;
    ANTHROPIC_BASE_URL: string;
    AGENT_MODEL: string;
    AGENT_MODEL_INPUT_PRICE_PER_M: string;
    AGENT_MODEL_OUTPUT_PRICE_PER_M: string;
    AGENT_EMBED_MODEL: string;

    // Embeddings
    VOYAGE_API_KEY: string;

    // Observability
    LANGFUSE_PUBLIC_KEY: string;
    LANGFUSE_SECRET_KEY: string;
    LANGFUSE_HOST: string;

    // Redis
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;

    // IPFS proof
    IRYS_PRIVATE_KEY: string;

    // Chains
    ARC_RPC_URL: string;
    POLYGON_RPC_URL: string;
    AGENT_EOA_PRIVATE_KEY: string;
    ATTRIBUTION_ESCROW_ADDRESS: string;

    // Polymarket
    POLYMARKET_API_HOST: string;
    POLYMARKET_GAMMA_HOST: string;
    POLYMARKET_BUILDER_CODE: string;
    POLYMARKET_SIGNER_KEY: string;
    POLYMARKET_LIVE_POSTING: string;
    POLYMARKET_FEE_BPS: string;
    POLYGON_CTF_EXCHANGE_ADDRESS: string;
  }
}
