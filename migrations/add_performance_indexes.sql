-- Performance Optimization Indexes
-- This migration adds composite indexes to improve JOIN performance
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Inbound table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbound_wsn_warehouse 
    ON inbound(wsn, warehouse_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbound_warehouse_created 
    ON inbound(warehouse_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbound_warehouse_date 
    ON inbound(warehouse_id, inbound_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbound_batch_id 
    ON inbound(batch_id) WHERE batch_id IS NOT NULL;

-- QC table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qc_wsn_warehouse 
    ON qc(wsn, warehouse_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qc_warehouse_date 
    ON qc(warehouse_id, qc_date DESC);

-- Picking table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picking_wsn_warehouse 
    ON picking(wsn, warehouse_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picking_warehouse_date 
    ON picking(warehouse_id, picking_date DESC);

-- Outbound table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbound_wsn_warehouse 
    ON outbound(wsn, warehouse_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbound_warehouse_dispatch 
    ON outbound(warehouse_id, dispatch_date DESC);

-- Master data indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_master_data_wsn_upper 
    ON master_data(UPPER(wsn));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_master_data_batch_id 
    ON master_data(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_master_data_brand 
    ON master_data(brand) WHERE brand IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_master_data_cms_vertical 
    ON master_data(cms_vertical) WHERE cms_vertical IS NOT NULL;

-- Analyze tables to update query planner statistics
ANALYZE inbound;
ANALYZE qc;
ANALYZE picking;
ANALYZE outbound;
ANALYZE master_data;
