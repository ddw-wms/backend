-- ============================================================================
-- ADD PIVOT TABLE PERMISSION - Dashboard Pivot Analysis Feature
-- Run: psql -h localhost -U postgres -d wms_db -f migrations/add_pivot_permission.sql
-- ============================================================================

-- Add pivot button permission for dashboard
INSERT INTO permissions (permission_key, permission_name, category, description) 
VALUES ('dashboard_btn_pivot', 'Dashboard Pivot Button', 'dashboard', 'Use pivot analysis feature on dashboard')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant to Admin role automatically
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'Admin' 
  AND p.permission_key = 'dashboard_btn_pivot'
ON CONFLICT DO NOTHING;

-- Grant to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'Manager' 
  AND p.permission_key = 'dashboard_btn_pivot'
ON CONFLICT DO NOTHING;

-- Grant to Supervisor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'Supervisor' 
  AND p.permission_key = 'dashboard_btn_pivot'
ON CONFLICT DO NOTHING;

SELECT 'Pivot permission added successfully!' as status;
