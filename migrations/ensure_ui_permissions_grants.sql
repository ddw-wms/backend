-- Migration: ensure_ui_permissions_grants.sql
-- Ensures admin role has UI list/grid permissions for Inbound/Outbound/Picking/Dashboard

INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'admin', permission_key, true FROM permissions WHERE permission_key IN (
  'inbound_list_columns_settings', 'inbound_list_grid_settings',
  'outbound_list_columns_settings', 'outbound_list_grid_settings',
  'picking_list_columns_settings', 'picking_list_grid_settings',
  'dashboard_columns_settings', 'dashboard_grid_settings'
) ON CONFLICT (role, permission_key) DO NOTHING;