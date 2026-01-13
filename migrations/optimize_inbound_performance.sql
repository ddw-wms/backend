-- Migration: COMPLETE WMS Performance Optimization
-- Date: 2026-01-13
-- Purpose: Add indexes to ALL tables for instant loading with 1M+ rows
-- Covers: inbound, qc, picking, outbound, master_data

-- ===========================================
-- ENABLE EXTENSIONS (run first)
-- ===========================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===========================================
-- INBOUND TABLE INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_inbound_warehouse_id ON inbound(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inbound_wsn ON inbound(wsn);
CREATE INDEX IF NOT EXISTS idx_inbound_wsn_upper ON inbound(UPPER(wsn));
CREATE INDEX IF NOT EXISTS idx_inbound_created_at ON inbound(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_inbound_date ON inbound(inbound_date);
CREATE INDEX IF NOT EXISTS idx_inbound_batch_id ON inbound(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_warehouse_created ON inbound(warehouse_id, created_at DESC);
-- Composite for filtered + sorted queries
CREATE INDEX IF NOT EXISTS idx_inbound_wh_date_created ON inbound(warehouse_id, inbound_date, created_at DESC);

-- ===========================================
-- MASTER_DATA TABLE INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_master_data_wsn ON master_data(wsn);
CREATE INDEX IF NOT EXISTS idx_master_data_wsn_upper ON master_data(UPPER(wsn));
CREATE INDEX IF NOT EXISTS idx_master_data_brand ON master_data(brand) WHERE brand IS NOT NULL AND brand != '';
CREATE INDEX IF NOT EXISTS idx_master_data_category ON master_data(cms_vertical) WHERE cms_vertical IS NOT NULL AND cms_vertical != '';

-- ===========================================
-- QC TABLE INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_qc_warehouse_id ON qc(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_qc_wsn ON qc(wsn);
CREATE INDEX IF NOT EXISTS idx_qc_wsn_upper ON qc(UPPER(wsn));
CREATE INDEX IF NOT EXISTS idx_qc_created_at ON qc(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_qc_date ON qc(qc_date);
CREATE INDEX IF NOT EXISTS idx_qc_qc_status ON qc(qc_status) WHERE qc_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qc_qc_grade ON qc(qc_grade) WHERE qc_grade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qc_batch_id ON qc(batch_id) WHERE batch_id IS NOT NULL;
-- Composite for warehouse + sorting
CREATE INDEX IF NOT EXISTS idx_qc_warehouse_created ON qc(warehouse_id, created_at DESC);
-- For JOIN performance
CREATE INDEX IF NOT EXISTS idx_qc_wsn_warehouse ON qc(wsn, warehouse_id);

-- ===========================================
-- PICKING TABLE INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_picking_warehouse_id ON picking(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_picking_wsn ON picking(wsn);
CREATE INDEX IF NOT EXISTS idx_picking_wsn_upper ON picking(UPPER(wsn));
CREATE INDEX IF NOT EXISTS idx_picking_created_at ON picking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picking_picking_date ON picking(picking_date);
CREATE INDEX IF NOT EXISTS idx_picking_batch_id ON picking(batch_id) WHERE batch_id IS NOT NULL;
-- Composite for warehouse + sorting
CREATE INDEX IF NOT EXISTS idx_picking_warehouse_created ON picking(warehouse_id, created_at DESC);
-- For JOIN performance
CREATE INDEX IF NOT EXISTS idx_picking_wsn_warehouse ON picking(wsn, warehouse_id);

-- ===========================================
-- OUTBOUND TABLE INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_outbound_warehouse_id ON outbound(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_outbound_wsn ON outbound(wsn);
CREATE INDEX IF NOT EXISTS idx_outbound_wsn_upper ON outbound(UPPER(wsn));
-- Note: outbound doesn't have created_at, use id DESC for sorting
CREATE INDEX IF NOT EXISTS idx_outbound_dispatch_date ON outbound(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_outbound_batch_id ON outbound(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbound_customer ON outbound(customer_name) WHERE customer_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbound_source ON outbound(source) WHERE source IS NOT NULL;
-- Composite for warehouse + sorting (using id since no created_at)
CREATE INDEX IF NOT EXISTS idx_outbound_warehouse_id_desc ON outbound(warehouse_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_id_desc ON outbound(id DESC);
-- For JOIN performance
CREATE INDEX IF NOT EXISTS idx_outbound_wsn_warehouse ON outbound(wsn, warehouse_id);
-- For dispatch status check
CREATE INDEX IF NOT EXISTS idx_outbound_dispatch_status ON outbound(wsn, warehouse_id, dispatch_date) WHERE dispatch_date IS NOT NULL;

-- ===========================================
-- ANALYZE ALL TABLES
-- ===========================================
ANALYZE inbound;
ANALYZE master_data;
ANALYZE qc;
ANALYZE picking;
ANALYZE outbound;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🚀 Complete WMS Performance Optimization Done!';
    RAISE NOTICE '✅ Indexes created for: inbound, qc, picking, outbound, master_data';
    RAISE NOTICE '✅ Tables analyzed';
END $$;
