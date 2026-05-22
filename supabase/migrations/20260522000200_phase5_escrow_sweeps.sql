-- Phase 5 tables: onchain escrow credits, CCTP sweep history, USYC stub events.

-- ============================================================================
-- escrow_credits: every successful creditFees() call against AttributionEscrow
-- ============================================================================

CREATE TABLE escrow_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    creator_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount_usdc NUMERIC(20,6) NOT NULL,
    arc_tx VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE escrow_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escrow_credits_owner_select" ON escrow_credits FOR SELECT USING (
    auth.uid() = creator_profile_id
);
CREATE POLICY "escrow_credits_service_modify" ON escrow_credits FOR ALL USING (
    auth.role() = 'service_role'
);

CREATE INDEX idx_escrow_credits_creator ON escrow_credits(creator_profile_id);
CREATE INDEX idx_escrow_credits_question ON escrow_credits(question_id);

-- ============================================================================
-- sweeps: CCTP v2 burn/attest/mint events Polygon Amoy -> Arc testnet
-- ============================================================================

CREATE TABLE sweeps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    amount_usdc NUMERIC(20,6) NOT NULL,
    burn_tx VARCHAR(255),
    attestation_id VARCHAR(255),
    mint_tx VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ
);

ALTER TABLE sweeps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sweeps_owner_select" ON sweeps FOR SELECT USING (
    auth.uid() = initiator_profile_id OR initiator_profile_id IS NULL
);
CREATE POLICY "sweeps_service_modify" ON sweeps FOR ALL USING (
    auth.role() = 'service_role'
);

CREATE INDEX idx_sweeps_initiator ON sweeps(initiator_profile_id);
CREATE INDEX idx_sweeps_status ON sweeps(status);

-- ============================================================================
-- usyc_events: testnet-only USYC subscribe/redeem stub log
-- ============================================================================

CREATE TABLE usyc_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    amount_usdc NUMERIC(20,6),
    amount_usyc NUMERIC(20,6),
    price_per_share NUMERIC(20,6),
    tx_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE usyc_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usyc_events_owner_select" ON usyc_events FOR SELECT USING (
    auth.uid() = profile_id
);
CREATE POLICY "usyc_events_service_modify" ON usyc_events FOR ALL USING (
    auth.role() = 'service_role'
);

CREATE INDEX idx_usyc_events_profile ON usyc_events(profile_id);

-- ============================================================================
-- attributions.currency: per-question currency so EURC and USDC accrue separately
-- ============================================================================

ALTER TABLE attributions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USDC';
