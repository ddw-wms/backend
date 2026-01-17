-- ========================================================
-- ADD APPEARANCE AND ERROR LOGS PAGE PERMISSIONS
-- These pages were added later and need permission entries
-- ========================================================
-- Created: January 17, 2026
-- ========================================================

-- First, check if the permissions table has code column or permission_key column
-- The newer schema uses: code, name, category, page, parent_code, sort_order
-- The older schema uses: permission_key, permission_name, category, description

-- Try inserting with the new schema (code, name, category, page)
-- If the columns don't exist, these will fail gracefully

-- ======================== SETTINGS - APPEARANCE PAGE ========================
-- Appearance page allows users to customize UI settings like theme, table row height etc.

INSERT INTO permissions (code, name, category, page, parent_code, sort_order) VALUES
-- Menu Permission (controls sidebar visibility)
('menu:settings:appearance', 'Appearance Page', 'settings', 'settings-appearance', NULL, 1500)
ON CONFLICT (code) DO NOTHING;

-- ======================== SETTINGS - ERROR LOGS PAGE ========================  
-- Error Logs page is for super admin to view system errors (already restricted by code)

INSERT INTO permissions (code, name, category, page, parent_code, sort_order) VALUES
-- Menu Permission (controls sidebar visibility) - Note: This page is already super_admin only in sidebar
('menu:settings:errorlogs', 'Error Logs Page', 'settings', 'settings-errorlogs', NULL, 1600)
ON CONFLICT (code) DO NOTHING;

-- ========================================================
-- GRANT PERMISSIONS TO ADMIN ROLE BY DEFAULT
-- ========================================================

-- Get admin role ID and grant these new permissions
INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'menu:settings:appearance', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Error logs should NOT be granted to admin by default (super_admin only)
-- So we skip granting menu:settings:errorlogs to admin

-- ========================================================
-- VERIFY INSERTIONS
-- ========================================================
SELECT code, name, category, page FROM permissions 
WHERE code IN ('menu:settings:appearance', 'menu:settings:errorlogs');

