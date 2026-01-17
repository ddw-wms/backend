-- ========================================================
-- ADD NEW BUTTON PERMISSIONS FOR MASTER DATA, USERS, BACKUPS PAGES
-- ========================================================
-- Created: January 17, 2026
-- ========================================================

-- ======================== MASTER DATA PAGE ========================
-- Add permission for Add button in master data tab

INSERT INTO permissions (code, name, category, page, parent_code, sort_order) VALUES
('btn:masterdata:add', 'Master Data - Add Button', 'settings', 'settings-masterdata', NULL, 800)
ON CONFLICT (code) DO NOTHING;

-- ======================== USERS PAGE ========================
-- Add permission for Force Logout button

INSERT INTO permissions (code, name, category, page, parent_code, sort_order) VALUES
('btn:users:force_logout', 'Users - Force Logout Button', 'settings', 'settings-users', NULL, 1100)
ON CONFLICT (code) DO NOTHING;

-- ======================== BACKUPS PAGE ========================
-- Add permissions for backup page buttons

INSERT INTO permissions (code, name, category, page, parent_code, sort_order) VALUES
('btn:backups:schedules', 'Backups - Schedules Button', 'settings', 'settings-backups', NULL, 1300),
('btn:backups:create', 'Backups - Create Backup Button', 'settings', 'settings-backups', NULL, 1301),
('btn:backups:restore', 'Backups - Restore Button', 'settings', 'settings-backups', NULL, 1302),
('btn:backups:delete', 'Backups - Delete Button', 'settings', 'settings-backups', NULL, 1303)
ON CONFLICT (code) DO NOTHING;

-- ========================================================
-- GRANT PERMISSIONS TO ADMIN ROLE BY DEFAULT
-- ========================================================

-- Master Data - Add button
INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'btn:masterdata:add', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Users - Force Logout button
INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'btn:users:force_logout', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Backups buttons
INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'btn:backups:schedules', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'btn:backups:create', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'btn:backups:restore', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, 'btn:backups:delete', true, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- ========================================================
-- VERIFY INSERTIONS
-- ========================================================
SELECT code, name, category, page FROM permissions 
WHERE code IN (
    'btn:masterdata:add',
    'btn:users:force_logout', 
    'btn:backups:schedules',
    'btn:backups:create',
    'btn:backups:restore',
    'btn:backups:delete'
);
