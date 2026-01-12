-- Migration: add_picking_ui_permissions.sql
-- Add UI-level permissions for Picking page actions

INSERT INTO permissions (permission_key, permission_name, category, description)
VALUES
('refresh_picking', 'Refresh Picking', 'picking', 'Refresh picking list or view'),
('picking_columns', 'Pickings - Columns', 'picking', 'Control visible columns on picking list'),
('picking_grid', 'Pickings - Grid Settings', 'picking', 'Control grid sorting/filtering/resizing on picking list')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant these permissions to admin by default
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'admin', permission_key, true FROM permissions WHERE permission_key IN ('refresh_picking','picking_columns','picking_grid')
ON CONFLICT (role, permission_key) DO NOTHING;
