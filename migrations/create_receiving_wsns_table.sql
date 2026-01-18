-- Migration: Create receiving_wsns table
-- Purpose: Track WSNs currently being scanned in multi-entry grids
-- This allows master data to show "Receiving" status for in-progress scanning

CREATE TABLE IF NOT EXISTS receiving_wsns (
    id SERIAL PRIMARY KEY,
    wsn VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wsn, warehouse_id)  -- Each WSN can only be in receiving state once per warehouse
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_receiving_wsns_wsn ON receiving_wsns(wsn);
CREATE INDEX IF NOT EXISTS idx_receiving_wsns_wsn_upper ON receiving_wsns(UPPER(wsn));
CREATE INDEX IF NOT EXISTS idx_receiving_wsns_user_id ON receiving_wsns(user_id);
CREATE INDEX IF NOT EXISTS idx_receiving_wsns_warehouse_id ON receiving_wsns(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_receiving_wsns_created_at ON receiving_wsns(created_at);

-- Auto-cleanup old entries (WSNs that have been in receiving state for more than 24 hours)
-- This handles cases where users don't properly clear their session
-- Can be run via cron job: DELETE FROM receiving_wsns WHERE created_at < NOW() - INTERVAL '24 hours';
