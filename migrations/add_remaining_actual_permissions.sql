-- ========================================================
-- REMOVE FAKE PERMISSIONS AND ADD ACTUAL UI PERMISSIONS
-- FOR ALL REMAINING PAGES
-- ========================================================
-- Created: January 7, 2026
-- Purpose: Clean up fake permissions and add only real UI elements
-- ========================================================

-- ========================================================
-- CUSTOMERS PAGE - Simple table with Add/Edit/Delete/Export/Refresh
-- No tabs, just action buttons
-- ========================================================

-- Remove any fake customer tabs
DELETE FROM permissions WHERE permission_key LIKE 'customers_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'customers_tab_%';
DELETE FROM user_permissions WHERE permission_key LIKE 'customers_tab_%';

-- Add actual Customer permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_customers', 'View Customers Page', 'customers', 'Access to customers page'),

-- Action Buttons
('customers_btn_add', 'Add Customer Button', 'customers', 'Show Add Customer button'),
('customers_btn_edit', 'Edit Customer Button', 'customers', 'Show Edit button on customers'),
('customers_btn_delete', 'Delete Customer Button', 'customers', 'Show Delete button on customers'),
('customers_btn_export', 'Export Customers Button', 'customers', 'Show Export button on customers page'),
('customers_btn_refresh', 'Refresh Customers Button', 'customers', 'Show Refresh button on customers page')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- REPORTS PAGE - Has 3 tabs
-- ========================================================

-- Remove fake report permissions
DELETE FROM permissions WHERE permission_key LIKE 'reports_tab_%' AND permission_key NOT IN (
  'reports_tab_analytics',
  'reports_tab_performance', 
  'reports_tab_exceptions'
);
DELETE FROM role_permissions WHERE permission_key LIKE 'reports_tab_%' AND permission_key NOT IN (
  'reports_tab_analytics',
  'reports_tab_performance',
  'reports_tab_exceptions'
);

-- Add actual Reports permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_reports', 'View Reports Page', 'reports', 'Access to reports page'),

-- Tab 1: Analytics Dashboard (charts, KPIs, trends)
('reports_tab_analytics', 'Analytics Dashboard Tab', 'reports', 'Access to Analytics Dashboard tab with charts and KPIs'),

-- Tab 2: Performance Reports (user/brand performance)
('reports_tab_performance', 'Performance Reports Tab', 'reports', 'Access to Performance Reports tab'),

-- Tab 3: Exception Reports (stuck inbound, QC failed, slow moving)
('reports_tab_exceptions', 'Exception Reports Tab', 'reports', 'Access to Exception Reports tab')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- SETTINGS - WAREHOUSES PAGE
-- No tabs, action buttons only
-- ========================================================

-- Remove fake warehouse tabs/permissions
DELETE FROM permissions WHERE permission_key LIKE 'warehouses_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'warehouses_tab_%';

-- Add actual Warehouses permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_warehouses', 'View Warehouses Page', 'warehouses', 'Access to warehouses settings page'),

-- Action Buttons
('warehouses_btn_add', 'Add Warehouse Button', 'warehouses', 'Show Add Warehouse button'),
('warehouses_btn_edit', 'Edit Warehouse Button', 'warehouses', 'Show Edit button on warehouses'),
('warehouses_btn_delete', 'Delete Warehouse Button', 'warehouses', 'Show Delete button on warehouses'),
('warehouses_btn_set_active', 'Set Active Warehouse Button', 'warehouses', 'Show Set Active button'),
('warehouses_btn_export', 'Export Warehouses Button', 'warehouses', 'Show Export button'),
('warehouses_btn_refresh', 'Refresh Warehouses Button', 'warehouses', 'Show Refresh button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- SETTINGS - RACKS PAGE
-- Has: Add, Edit, Delete, Toggle, Bulk Upload, Export, Refresh
-- ========================================================

-- Remove fake rack tabs/permissions
DELETE FROM permissions WHERE permission_key LIKE 'racks_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'racks_tab_%';

-- Add actual Racks permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_racks', 'View Racks Page', 'racks', 'Access to racks settings page'),

-- Action Buttons
('racks_btn_add', 'Add Rack Button', 'racks', 'Show Add Rack button'),
('racks_btn_edit', 'Edit Rack Button', 'racks', 'Show Edit button on racks'),
('racks_btn_delete', 'Delete Rack Button', 'racks', 'Show Delete button on racks'),
('racks_btn_toggle', 'Toggle Rack Status Button', 'racks', 'Show Toggle Active/Inactive button'),
('racks_btn_bulk_upload', 'Bulk Upload Racks Button', 'racks', 'Show Bulk Upload button for racks'),
('racks_btn_export', 'Export Racks Button', 'racks', 'Show Export button'),
('racks_btn_download_template', 'Download Template Button', 'racks', 'Show Download Template button'),
('racks_btn_refresh', 'Refresh Racks Button', 'racks', 'Show Refresh button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- SETTINGS - USERS PAGE
-- Has: Add, Edit, Delete, Change Password, Refresh
-- ========================================================

-- Remove fake user tabs
DELETE FROM permissions WHERE permission_key LIKE 'users_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'users_tab_%';

-- Add actual Users permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_users', 'View Users Page', 'users', 'Access to users settings page'),

-- Action Buttons
('users_btn_add', 'Add User Button', 'users', 'Show Add User button'),
('users_btn_edit', 'Edit User Button', 'users', 'Show Edit button on users'),
('users_btn_delete', 'Delete User Button', 'users', 'Show Delete button on users'),
('users_btn_change_password', 'Change Password Button', 'users', 'Show Change Password button'),
('users_btn_refresh', 'Refresh Users Button', 'users', 'Show Refresh button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- SETTINGS - BACKUPS PAGE
-- Has: Create Backup, Restore, Download, Delete, Schedule Management
-- ========================================================

-- Remove fake backup tabs
DELETE FROM permissions WHERE permission_key LIKE 'backups_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'backups_tab_%';

-- Add actual Backups permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_backups', 'View Backups Page', 'backups', 'Access to backups settings page'),

-- Action Buttons
('backups_btn_create', 'Create Backup Button', 'backups', 'Show Create Backup button'),
('backups_btn_restore', 'Restore Backup Button', 'backups', 'Show Restore button'),
('backups_btn_download', 'Download Backup Button', 'backups', 'Show Download button'),
('backups_btn_delete', 'Delete Backup Button', 'backups', 'Show Delete button'),
('backups_btn_schedule', 'Manage Schedule Button', 'backups', 'Show Schedule Management button'),
('backups_btn_health_check', 'Health Check Button', 'backups', 'Show Database Health Check button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- SETTINGS - PRINTERS PAGE
-- Has: Add, Edit, Delete, Test Print, Set Default
-- ========================================================

-- Remove fake printer tabs
DELETE FROM permissions WHERE permission_key LIKE 'printers_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'printers_tab_%';

-- Add actual Printers permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_printers', 'View Printers Page', 'printers', 'Access to printers settings page'),

-- Action Buttons
('printers_btn_add', 'Add Printer Button', 'printers', 'Show Add Printer button'),
('printers_btn_edit', 'Edit Printer Button', 'printers', 'Show Edit button on printers'),
('printers_btn_delete', 'Delete Printer Button', 'printers', 'Show Delete button on printers'),
('printers_btn_test', 'Test Print Button', 'printers', 'Show Test Print button'),
('printers_btn_set_default', 'Set Default Printer Button', 'printers', 'Show Set Default button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- SETTINGS - MASTER DATA PAGE
-- Check what tabs/options it has
-- ========================================================

-- Add actual Master Data permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_master_data', 'View Master Data Page', 'master-data', 'Access to master data settings page'),

-- Common actions
('master_data_btn_add', 'Add Master Data Button', 'master-data', 'Show Add button'),
('master_data_btn_edit', 'Edit Master Data Button', 'master-data', 'Show Edit button'),
('master_data_btn_delete', 'Delete Master Data Button', 'master-data', 'Show Delete button'),
('master_data_btn_export', 'Export Master Data Button', 'master-data', 'Show Export button'),
('master_data_btn_import', 'Import Master Data Button', 'master-data', 'Show Import button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- VERIFICATION QUERIES
-- ========================================================

-- Count permissions by category
SELECT category, COUNT(*) as permission_count 
FROM permissions 
GROUP BY category 
ORDER BY category;

-- Show all new permissions
SELECT permission_key, permission_name, category 
FROM permissions 
WHERE category IN ('customers', 'reports', 'warehouses', 'racks', 'users', 'backups', 'printers', 'master-data')
ORDER BY category, permission_key;
