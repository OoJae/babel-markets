-- Babel Markets, initial schema.
-- Builds on top of the standard Supabase auth.users table. Lifts the profile/wallet
-- shape from arc-p2p-payments and adds the 7 Babel-specific tables from playbook section 2.6.

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pgvector powers question dedup. Without it, the agent will flood Polymarket with
-- near-identical markets and get moderated.
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- profiles: user metadata layered on auth.users
-- ============================================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    email VARCHAR,
    locale VARCHAR(10),
    not_us_attested BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on user signup, with display name fallback.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    display_name TEXT;
BEGIN
    display_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        NEW.email
    );
    BEGIN
        INSERT INTO public.profiles (id, name, email)
        VALUES (NEW.id, display_name, NEW.email);
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- wallets: Circle Modular Wallets (user-facing, passkey)
-- ============================================================================

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    wallet_type VARCHAR(50) NOT NULL,
    blockchain VARCHAR(50) NOT NULL DEFAULT 'ARC',
    account_type VARCHAR(50) NOT NULL DEFAULT 'SCA',
    currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
    passkey_credential TEXT,
    circle_wallet_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_owner_select" ON wallets FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "wallets_owner_modify" ON wallets FOR ALL USING (auth.uid() = profile_id);

CREATE INDEX idx_wallets_profile_id ON wallets(profile_id);
CREATE INDEX idx_wallets_address ON wallets(wallet_address);

-- ============================================================================
-- submissions: raw pasted news, pre-processing
-- ============================================================================

CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    source_text TEXT NOT NULL,
    source_url TEXT,
    source_lang VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_owner_select" ON submissions FOR SELECT USING (
    auth.uid() = profile_id OR profile_id IS NULL
);
CREATE POLICY "submissions_owner_insert" ON submissions FOR INSERT WITH CHECK (
    auth.uid() = profile_id OR profile_id IS NULL
);

CREATE INDEX idx_submissions_profile_id ON submissions(profile_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- ============================================================================
-- questions: synthesized, tradable markets
-- ============================================================================

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    question_text VARCHAR(500) NOT NULL,
    resolution_rule TEXT NOT NULL,
    resolution_source TEXT NOT NULL,
    expiry TIMESTAMPTZ NOT NULL,
    category VARCHAR(40) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    suggested_probability NUMERIC(5,4),
    source_lang VARCHAR(10),
    -- Claude embeddings via voyage-3 are 1024-dim; OpenAI text-embedding-3-small is 1536.
    -- Pick 1536 to keep options open; we will pad / truncate as needed.
    embedding vector(1536),
    polymarket_market_id VARCHAR(255),
    ipfs_cid VARCHAR(255),
    quality_score NUMERIC(4,3),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_public_select" ON questions FOR SELECT USING (true);
CREATE POLICY "questions_service_insert" ON questions FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
);

CREATE INDEX idx_questions_submission_id ON questions(submission_id);
CREATE INDEX idx_questions_profile_id ON questions(profile_id);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_polymarket_market_id ON questions(polymarket_market_id);
-- HNSW index for cosine-similarity dedup over embeddings.
CREATE INDEX idx_questions_embedding ON questions USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- traces: per-step agent reasoning, mirrored to Langfuse and IPFS
-- ============================================================================

CREATE TABLE traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    step VARCHAR(40) NOT NULL,
    model VARCHAR(80),
    input JSONB,
    output JSONB,
    score NUMERIC(4,3),
    latency_ms INTEGER,
    cost_usdc NUMERIC(12,8),
    langfuse_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "traces_public_select" ON traces FOR SELECT USING (true);

CREATE INDEX idx_traces_question_id ON traces(question_id);
CREATE INDEX idx_traces_submission_id ON traces(submission_id);
CREATE INDEX idx_traces_step ON traces(step);

-- ============================================================================
-- fills: Polymarket trades that earned a builder fee
-- ============================================================================

CREATE TABLE fills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    polymarket_market_id VARCHAR(255) NOT NULL,
    taker VARCHAR(255),
    side VARCHAR(10),
    size_usdc NUMERIC(20,6) NOT NULL,
    price NUMERIC(8,6),
    builder_fee_usdc NUMERIC(20,6) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fills_public_select" ON fills FOR SELECT USING (true);
CREATE POLICY "fills_service_insert" ON fills FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
);

CREATE INDEX idx_fills_question_id ON fills(question_id);
CREATE INDEX idx_fills_polymarket_market_id ON fills(polymarket_market_id);
CREATE INDEX idx_fills_tx_hash ON fills(tx_hash);
CREATE UNIQUE INDEX uq_fills_tx_hash_side ON fills(tx_hash, side);

-- ============================================================================
-- attributions: running fee balance per creator
-- ============================================================================

CREATE TABLE attributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    creator_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    accrued_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,
    paid_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,
    last_payout_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, creator_profile_id)
);

ALTER TABLE attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attributions_owner_select" ON attributions FOR SELECT USING (
    auth.uid() = creator_profile_id
);
CREATE POLICY "attributions_service_modify" ON attributions FOR ALL USING (
    auth.role() = 'service_role'
);

CREATE INDEX idx_attributions_creator_profile_id ON attributions(creator_profile_id);

-- ============================================================================
-- payouts: weekly settled payments to creators
-- ============================================================================

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount_usdc NUMERIC(20,6) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
    cctp_tx VARCHAR(255),
    arc_tx VARCHAR(255),
    usyc_redeemed NUMERIC(20,6),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_owner_select" ON payouts FOR SELECT USING (
    auth.uid() = creator_profile_id
);
CREATE POLICY "payouts_service_modify" ON payouts FOR ALL USING (
    auth.role() = 'service_role'
);

CREATE INDEX idx_payouts_creator_profile_id ON payouts(creator_profile_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_wallets_touch BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_attributions_touch BEFORE UPDATE ON attributions
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================================
-- Grants
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION uuid_generate_v4() TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON profiles, wallets, questions, traces, fills, attributions, payouts TO authenticated;
GRANT INSERT, UPDATE ON profiles, wallets, submissions TO authenticated;
