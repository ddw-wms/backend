-- Migration: Add Master Data Edit and Delete Action Button Permissions
-- Date: 2026-01-22

-- Step 1: Add new permissions to permissions table
INSERT INTO permissions (code, name, category, page, parent_code, sort_order)
VALUES 
    ('btn:masterdata:edit', 'Master Data - Edit Button', 'button', 'settings-masterdata', 'tab:masterdata:list', 850),
    ('btn:masterdata:delete', 'Master Data - Delete Button', 'button', 'settings-masterdata', 'tab:masterdata:list', 851)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Grant these permissions to ALL existing roles (to not break current functionality)
-- This ensures existing users can still edit/delete as before
INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, p.code, true, true
FROM roles r
CROSS JOIN (
    SELECT 'btn:masterdata:edit' as code
    UNION ALL
    SELECT 'btn:masterdata:delete'
) p
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Verify
SELECT 'New permissions added:' as status;
SELECT code, name FROM permissions WHERE code IN ('btn:masterdata:edit', 'btn:masterdata:delete');

SELECT 'Permissions granted to roles:' as status;
SELECT r.name as role_name, rp.permission_code, rp.is_enabled 
FROM role_permissions rp 
JOIN roles r ON r.id = rp.role_id 
WHERE rp.permission_code IN ('btn:masterdata:edit', 'btn:masterdata:delete')
ORDER BY r.name, rp.permission_code;
