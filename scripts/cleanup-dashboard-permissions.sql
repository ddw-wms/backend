-- Cleanup invalid dashboard permissions
-- Keep only the permissions that are actually used in the code

-- First, let's see what we have
SELECT permission_key, permission_name, category 
FROM permissions 
WHERE category = 'dashboard' 
ORDER BY permission_key;

-- Delete invalid dashboard permissions (ones not used in code)
DELETE FROM role_permissions 
WHERE permission_key IN (
    SELECT permission_key FROM permissions 
    WHERE category = 'dashboard' 
    AND permission_key NOT IN (
        'view_dashboard',
        'view_dashboard_stats',
        'view_dashboard_charts',
        'export_dashboard',
        'dashboard_filter_warehouse',
        'refresh_dashboard'
    )
);

DELETE FROM permissions 
WHERE category = 'dashboard' 
AND permission_key NOT IN (
    'view_dashboard',
    'view_dashboard_stats',
    'view_dashboard_charts',
    'export_dashboard',
    'dashboard_filter_warehouse',
    'refresh_dashboard'
);

-- Add missing permissions if they don't exist
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_dashboard', 'View Dashboard Page', 'dashboard', 'Access to dashboard page'),
('view_dashboard_stats', 'View Dashboard Statistics', 'dashboard', 'View statistics and KPIs'),
('view_dashboard_charts', 'View Dashboard Charts', 'dashboard', 'View charts and graphs'),
('export_dashboard', 'Export Dashboard Data', 'dashboard', 'Export dashboard data'),
('dashboard_filter_warehouse', 'Dashboard Warehouse Filter', 'dashboard', 'Use warehouse filter'),
('refresh_dashboard', 'Dashboard Refresh Button', 'dashboard', 'Use refresh button')
ON CONFLICT (permission_key) DO NOTHING;

-- Show final result
SELECT permission_key, permission_name 
FROM permissions 
WHERE category = 'dashboard' 
ORDER BY permission_key;
