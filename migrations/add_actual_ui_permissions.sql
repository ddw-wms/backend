-- ========================================================
-- ACTUAL UI PERMISSIONS (Based on Real Frontend Structure)
-- ========================================================
-- Created: January 7, 2026
-- Purpose: Remove fake permissions and add only ACTUAL UI elements
--          that exist in the application
-- ========================================================

-- ========================================================
-- STEP 1: DELETE FAKE/NON-EXISTENT PERMISSIONS
-- ========================================================

-- Delete Dashboard Analytics Tab (doesn't exist in actual UI)
DELETE FROM permissions WHERE permission_key = 'dashboard_tab_analytics';
DELETE FROM role_permissions WHERE permission_key = 'dashboard_tab_analytics';
DELETE FROM user_permissions WHERE permission_key = 'dashboard_tab_analytics';

-- Delete Dashboard Overview Tab (doesn't exist in actual UI)
DELETE FROM permissions WHERE permission_key = 'dashboard_tab_overview';
DELETE FROM role_permissions WHERE permission_key = 'dashboard_tab_overview';
DELETE FROM user_permissions WHERE permission_key = 'dashboard_tab_overview';

-- Delete other non-existent dashboard tabs
DELETE FROM permissions WHERE permission_key LIKE 'dashboard_tab_%';
DELETE FROM role_permissions WHERE permission_key LIKE 'dashboard_tab_%';
DELETE FROM user_permissions WHERE permission_key LIKE 'dashboard_tab_%';


-- ========================================================
-- STEP 2: ADD ACTUAL DASHBOARD PERMISSIONS
-- ========================================================

-- Dashboard has NO TABS in actual UI - it's a single page with filters and grid
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Page Level
('view_dashboard', 'View Dashboard Page', 'dashboard', 'Access to dashboard page'),

-- Column Settings Button
('dashboard_columns_settings', 'Dashboard Column Settings', 'dashboard', 'Enable/disable column settings button'),

-- Grid Settings Button  
('dashboard_grid_settings', 'Dashboard Grid Settings', 'dashboard', 'Enable/disable grid settings button (sortable, filter, resizable)'),

-- Export Button
('dashboard_export', 'Dashboard Export', 'dashboard', 'Enable/disable export to Excel button')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- STEP 3: ADD ACTUAL INBOUND PERMISSIONS (5 TABS)
-- ========================================================

-- Inbound has 5 tabs: Inbound List, Single Entry, Bulk Upload, Multi Entry, Batch Manager
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES

-- Page Level
('view_inbound', 'View Inbound Page', 'inbound', 'Access to inbound page'),

-- Tab 1: Inbound List
('inbound_tab_list', 'Inbound List Tab', 'inbound', 'Access to Inbound List tab'),
('inbound_list_columns_settings', 'Inbound List Column Settings', 'inbound', 'Column settings button on Inbound List tab'),
('inbound_list_grid_settings', 'Inbound List Grid Settings', 'inbound', 'Grid settings button on Inbound List tab'),
('inbound_list_export', 'Inbound List Export', 'inbound', 'Export button on Inbound List tab'),

-- Tab 2: Single Entry
('inbound_tab_single_entry', 'Single Entry Tab', 'inbound', 'Access to Single Entry tab'),

-- Tab 3: Bulk Upload
('inbound_tab_bulk_upload', 'Bulk Upload Tab', 'inbound', 'Access to Bulk Upload tab'),

-- Tab 4: Multi Entry
('inbound_tab_multi_entry', 'Multi Entry Tab', 'inbound', 'Access to Multi Entry tab'),

-- Tab 5: Batch Manager
('inbound_tab_batch_manager', 'Batch Manager Tab', 'inbound', 'Access to Batch Manager tab')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- STEP 4: ADD ACTUAL PICKING PERMISSIONS (5 TABS)
-- ========================================================

-- Picking has 5 tabs similar to Inbound
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES

-- Page Level
('view_picking', 'View Picking Page', 'picking', 'Access to picking page'),

-- Tab 1: Picking List
('picking_tab_list', 'Picking List Tab', 'picking', 'Access to Picking List tab'),
('picking_list_columns_settings', 'Picking List Column Settings', 'picking', 'Column settings button on Picking List tab'),
('picking_list_grid_settings', 'Picking List Grid Settings', 'picking', 'Grid settings button on Picking List tab'),
('picking_list_export', 'Picking List Export', 'picking', 'Export button on Picking List tab'),

-- Tab 2: Single Entry
('picking_tab_single_entry', 'Single Entry Tab', 'picking', 'Access to Single Entry tab'),

-- Tab 3: Bulk Upload
('picking_tab_bulk_upload', 'Bulk Upload Tab', 'picking', 'Access to Bulk Upload tab'),

-- Tab 4: Multi Entry
('picking_tab_multi_entry', 'Multi Entry Tab', 'picking', 'Access to Multi Entry tab'),

-- Tab 5: Batch Manager
('picking_tab_batch_manager', 'Batch Manager Tab', 'picking', 'Access to Batch Manager tab')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- STEP 5: ADD ACTUAL QC PERMISSIONS (5 TABS)
-- ========================================================

-- QC has 5 tabs similar to Inbound
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES

-- Page Level
('view_qc', 'View QC Page', 'qc', 'Access to QC page'),

-- Tab 1: QC List
('qc_tab_list', 'QC List Tab', 'qc', 'Access to QC List tab'),
('qc_list_columns_settings', 'QC List Column Settings', 'qc', 'Column settings button on QC List tab'),
('qc_list_grid_settings', 'QC List Grid Settings', 'qc', 'Grid settings button on QC List tab'),
('qc_list_export', 'QC List Export', 'qc', 'Export button on QC List tab'),

-- Tab 2: Single Entry
('qc_tab_single_entry', 'Single Entry Tab', 'qc', 'Access to Single Entry tab'),

-- Tab 3: Bulk Upload
('qc_tab_bulk_upload', 'Bulk Upload Tab', 'qc', 'Access to Bulk Upload tab'),

-- Tab 4: Multi Entry
('qc_tab_multi_entry', 'Multi Entry Tab', 'qc', 'Access to Multi Entry tab'),

-- Tab 5: Batch Manager
('qc_tab_batch_manager', 'Batch Manager Tab', 'qc', 'Access to Batch Manager tab')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- STEP 6: ADD ACTUAL OUTBOUND PERMISSIONS (5 TABS)
-- ========================================================

-- Outbound has 5 tabs similar to Inbound
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES

-- Page Level
('view_outbound', 'View Outbound Page', 'outbound', 'Access to outbound page'),

-- Tab 1: Outbound List
('outbound_tab_list', 'Outbound List Tab', 'outbound', 'Access to Outbound List tab'),
('outbound_list_columns_settings', 'Outbound List Column Settings', 'outbound', 'Column settings button on Outbound List tab'),
('outbound_list_grid_settings', 'Outbound List Grid Settings', 'outbound', 'Grid settings button on Outbound List tab'),
('outbound_list_export', 'Outbound List Export', 'outbound', 'Export button on Outbound List tab'),

-- Tab 2: Single Entry
('outbound_tab_single_entry', 'Single Entry Tab', 'outbound', 'Access to Single Entry tab'),

-- Tab 3: Bulk Upload
('outbound_tab_bulk_upload', 'Bulk Upload Tab', 'outbound', 'Access to Bulk Upload tab'),

-- Tab 4: Multi Entry
('outbound_tab_multi_entry', 'Multi Entry Tab', 'outbound', 'Access to Multi Entry tab'),

-- Tab 5: Batch Manager
('outbound_tab_batch_manager', 'Batch Manager Tab', 'outbound', 'Access to Batch Manager tab')

ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;


-- ========================================================
-- VERIFICATION
-- ========================================================

-- Count total permissions
SELECT COUNT(*) as total_permissions FROM permissions;

-- Show all dashboard permissions
SELECT permission_key, permission_name, category FROM permissions WHERE category = 'dashboard' ORDER BY permission_key;

-- Show all inbound permissions
SELECT permission_key, permission_name, category FROM permissions WHERE category = 'inbound' ORDER BY permission_key;

-- Show all picking permissions
SELECT permission_key, permission_name, category FROM permissions WHERE category = 'picking' ORDER BY permission_key;

-- Show all qc permissions
SELECT permission_key, permission_name, category FROM permissions WHERE category = 'qc' ORDER BY permission_key;

-- Show all outbound permissions
SELECT permission_key, permission_name, category FROM permissions WHERE category = 'outbound' ORDER BY permission_key;
