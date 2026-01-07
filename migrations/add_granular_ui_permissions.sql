-- ============================================================================
-- GRANULAR UI PERMISSIONS - Detailed control for every page component
-- This allows enabling/disabling specific tabs, buttons, filters, actions
-- ============================================================================

-- ======================== DASHBOARD PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('dashboard_tab_overview', 'Dashboard Overview Tab', 'dashboard', 'Access to overview tab'),
('dashboard_tab_analytics', 'Dashboard Analytics Tab', 'dashboard', 'Access to analytics tab'),
('dashboard_filter_warehouse', 'Dashboard Warehouse Filter', 'dashboard', 'Use warehouse filter'),
('dashboard_filter_daterange', 'Dashboard Date Range Filter', 'dashboard', 'Use date range filter'),
('dashboard_btn_refresh', 'Dashboard Refresh Button', 'dashboard', 'Use refresh button'),
('dashboard_btn_export', 'Dashboard Export Button', 'dashboard', 'Use export button');

-- ======================== INBOUND PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('inbound_tab_list', 'Inbound List Tab', 'inbound', 'Access to list view tab'),
('inbound_tab_create', 'Inbound Create Tab', 'inbound', 'Access to create/multi-entry tab'),
('inbound_btn_add', 'Inbound Add Button', 'inbound', 'Use add new button'),
('inbound_btn_edit', 'Inbound Edit Button', 'inbound', 'Use edit button'),
('inbound_btn_delete', 'Inbound Delete Button', 'inbound', 'Use delete button'),
('inbound_btn_receive', 'Inbound Receive Button', 'inbound', 'Use receive button'),
('inbound_btn_export', 'Inbound Export Button', 'inbound', 'Use export button'),
('inbound_btn_import', 'Inbound Import Button', 'inbound', 'Use import/bulk upload button'),
('inbound_btn_refresh', 'Inbound Refresh Button', 'inbound', 'Use refresh button'),
('inbound_btn_print', 'Inbound Print Button', 'inbound', 'Use print labels button'),
('inbound_filter_search', 'Inbound Search Filter', 'inbound', 'Use search filter'),
('inbound_filter_status', 'Inbound Status Filter', 'inbound', 'Use status filter'),
('inbound_filter_date', 'Inbound Date Filter', 'inbound', 'Use date filter'),
('inbound_filter_customer', 'Inbound Customer Filter', 'inbound', 'Use customer filter'),
('inbound_action_submit', 'Inbound Submit Action', 'inbound', 'Submit inbound orders');

-- ======================== OUTBOUND PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('outbound_tab_list', 'Outbound List Tab', 'outbound', 'Access to list view tab'),
('outbound_tab_create', 'Outbound Create Tab', 'outbound', 'Access to create/multi-entry tab'),
('outbound_btn_add', 'Outbound Add Button', 'outbound', 'Use add new button'),
('outbound_btn_edit', 'Outbound Edit Button', 'outbound', 'Use edit button'),
('outbound_btn_delete', 'Outbound Delete Button', 'outbound', 'Use delete button'),
('outbound_btn_dispatch', 'Outbound Dispatch Button', 'outbound', 'Use dispatch button'),
('outbound_btn_export', 'Outbound Export Button', 'outbound', 'Use export button'),
('outbound_btn_import', 'Outbound Import Button', 'outbound', 'Use import button'),
('outbound_btn_refresh', 'Outbound Refresh Button', 'outbound', 'Use refresh button'),
('outbound_btn_print', 'Outbound Print Button', 'outbound', 'Use print labels button'),
('outbound_filter_search', 'Outbound Search Filter', 'outbound', 'Use search filter'),
('outbound_filter_status', 'Outbound Status Filter', 'outbound', 'Use status filter'),
('outbound_filter_date', 'Outbound Date Filter', 'outbound', 'Use date filter'),
('outbound_filter_customer', 'Outbound Customer Filter', 'outbound', 'Use customer filter'),
('outbound_action_submit', 'Outbound Submit Action', 'outbound', 'Submit outbound orders');

-- ======================== PICKING PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('picking_tab_list', 'Picking List Tab', 'picking', 'Access to list view tab'),
('picking_tab_multi', 'Picking Multi-Entry Tab', 'picking', 'Access to multi-entry tab'),
('picking_btn_add', 'Picking Add Button', 'picking', 'Use add button'),
('picking_btn_edit', 'Picking Edit Button', 'picking', 'Use edit button'),
('picking_btn_delete', 'Picking Delete Button', 'picking', 'Use delete button'),
('picking_btn_complete', 'Picking Complete Button', 'picking', 'Use complete button'),
('picking_btn_cancel', 'Picking Cancel Button', 'picking', 'Use cancel button'),
('picking_btn_export', 'Picking Export Button', 'picking', 'Use export button'),
('picking_btn_refresh', 'Picking Refresh Button', 'picking', 'Use refresh button'),
('picking_btn_print', 'Picking Print Button', 'picking', 'Use print labels button'),
('picking_filter_search', 'Picking Search Filter', 'picking', 'Use search filter'),
('picking_filter_customer', 'Picking Customer Filter', 'picking', 'Use customer filter'),
('picking_filter_date', 'Picking Date Filter', 'picking', 'Use date filter'),
('picking_filter_status', 'Picking Status Filter', 'picking', 'Use status filter'),
('picking_action_submit', 'Picking Submit Action', 'picking', 'Submit picking tasks');

-- ======================== QC PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('qc_tab_list', 'QC List Tab', 'qc', 'Access to list view tab'),
('qc_tab_create', 'QC Create Tab', 'qc', 'Access to create tab'),
('qc_btn_add', 'QC Add Button', 'qc', 'Use add button'),
('qc_btn_edit', 'QC Edit Button', 'qc', 'Use edit button'),
('qc_btn_delete', 'QC Delete Button', 'qc', 'Use delete button'),
('qc_btn_approve', 'QC Approve Button', 'qc', 'Use approve button'),
('qc_btn_reject', 'QC Reject Button', 'qc', 'Use reject button'),
('qc_btn_export', 'QC Export Button', 'qc', 'Use export button'),
('qc_btn_import', 'QC Import Button', 'qc', 'Use import button'),
('qc_btn_refresh', 'QC Refresh Button', 'qc', 'Use refresh button'),
('qc_btn_print', 'QC Print Button', 'qc', 'Use print labels button'),
('qc_filter_search', 'QC Search Filter', 'qc', 'Use search filter'),
('qc_filter_status', 'QC Status Filter', 'qc', 'Use status filter'),
('qc_filter_batch', 'QC Batch Filter', 'qc', 'Use batch filter'),
('qc_filter_date', 'QC Date Filter', 'qc', 'Use date filter'),
('qc_action_submit', 'QC Submit Action', 'qc', 'Submit QC inspections');

-- ======================== INVENTORY PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('inventory_tab_current', 'Inventory Current Tab', 'inventory', 'Access to current stock tab'),
('inventory_tab_movement', 'Inventory Movement Tab', 'inventory', 'Access to movement history tab'),
('inventory_btn_adjust', 'Inventory Adjust Button', 'inventory', 'Use adjust inventory button'),
('inventory_btn_move', 'Inventory Move Button', 'inventory', 'Use move inventory button'),
('inventory_btn_export', 'Inventory Export Button', 'inventory', 'Use export button'),
('inventory_btn_refresh', 'Inventory Refresh Button', 'inventory', 'Use refresh button'),
('inventory_filter_search', 'Inventory Search Filter', 'inventory', 'Use search filter'),
('inventory_filter_warehouse', 'Inventory Warehouse Filter', 'inventory', 'Use warehouse filter'),
('inventory_filter_category', 'Inventory Category Filter', 'inventory', 'Use category filter'),
('inventory_filter_brand', 'Inventory Brand Filter', 'inventory', 'Use brand filter');

-- ======================== CUSTOMERS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('customers_btn_add', 'Customers Add Button', 'customers', 'Use add customer button'),
('customers_btn_edit', 'Customers Edit Button', 'customers', 'Use edit button'),
('customers_btn_delete', 'Customers Delete Button', 'customers', 'Use delete button'),
('customers_btn_export', 'Customers Export Button', 'customers', 'Use export button'),
('customers_btn_refresh', 'Customers Refresh Button', 'customers', 'Use refresh button'),
('customers_filter_search', 'Customers Search Filter', 'customers', 'Use search filter'),
('customers_filter_status', 'Customers Status Filter', 'customers', 'Use status filter');

-- ======================== MASTER DATA PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('masterdata_tab_products', 'Master Data Products Tab', 'master-data', 'Access to products tab'),
('masterdata_tab_categories', 'Master Data Categories Tab', 'master-data', 'Access to categories tab'),
('masterdata_tab_brands', 'Master Data Brands Tab', 'master-data', 'Access to brands tab'),
('masterdata_btn_add', 'Master Data Add Button', 'master-data', 'Use add button'),
('masterdata_btn_edit', 'Master Data Edit Button', 'master-data', 'Use edit button'),
('masterdata_btn_delete', 'Master Data Delete Button', 'master-data', 'Use delete button'),
('masterdata_btn_export', 'Master Data Export Button', 'master-data', 'Use export button'),
('masterdata_btn_import', 'Master Data Import Button', 'master-data', 'Use import button'),
('masterdata_btn_download_template', 'Master Data Download Template', 'master-data', 'Download template button'),
('masterdata_filter_search', 'Master Data Search Filter', 'master-data', 'Use search filter');

-- ======================== WAREHOUSES PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('warehouses_btn_add', 'Warehouses Add Button', 'warehouses', 'Use add warehouse button'),
('warehouses_btn_edit', 'Warehouses Edit Button', 'warehouses', 'Use edit button'),
('warehouses_btn_delete', 'Warehouses Delete Button', 'warehouses', 'Use delete button'),
('warehouses_btn_activate', 'Warehouses Activate Button', 'warehouses', 'Use activate/set active button'),
('warehouses_btn_export', 'Warehouses Export Button', 'warehouses', 'Use export button'),
('warehouses_filter_search', 'Warehouses Search Filter', 'warehouses', 'Use search filter'),
('warehouses_filter_city', 'Warehouses City Filter', 'warehouses', 'Use city filter');

-- ======================== RACKS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('racks_btn_add', 'Racks Add Button', 'racks', 'Use add rack button'),
('racks_btn_edit', 'Racks Edit Button', 'racks', 'Use edit button'),
('racks_btn_delete', 'Racks Delete Button', 'racks', 'Use delete button'),
('racks_btn_toggle', 'Racks Toggle Status Button', 'racks', 'Use toggle active/inactive button'),
('racks_btn_export', 'Racks Export Button', 'racks', 'Use export button'),
('racks_btn_import', 'Racks Bulk Upload Button', 'racks', 'Use bulk upload button'),
('racks_btn_download_template', 'Racks Download Template', 'racks', 'Download template button'),
('racks_filter_search', 'Racks Search Filter', 'racks', 'Use search filter'),
('racks_filter_warehouse', 'Racks Warehouse Filter', 'racks', 'Use warehouse filter'),
('racks_filter_status', 'Racks Status Filter', 'racks', 'Use status filter');

-- ======================== USERS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('users_btn_add', 'Users Add Button', 'users', 'Use add user button'),
('users_btn_edit', 'Users Edit Button', 'users', 'Use edit button'),
('users_btn_delete', 'Users Delete Button', 'users', 'Use delete button'),
('users_btn_change_password', 'Users Change Password Button', 'users', 'Use change password button'),
('users_btn_export', 'Users Export Button', 'users', 'Use export button'),
('users_filter_search', 'Users Search Filter', 'users', 'Use search filter'),
('users_filter_role', 'Users Role Filter', 'users', 'Use role filter'),
('users_filter_status', 'Users Status Filter', 'users', 'Use status filter');

-- ======================== BACKUPS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('backups_btn_create', 'Backups Create Button', 'backups', 'Use create backup button'),
('backups_btn_restore', 'Backups Restore Button', 'backups', 'Use restore button'),
('backups_btn_delete', 'Backups Delete Button', 'backups', 'Use delete button'),
('backups_btn_download', 'Backups Download Button', 'backups', 'Use download button'),
('backups_btn_view_stats', 'Backups View Stats Button', 'backups', 'View database statistics'),
('backups_btn_schedules', 'Backups Manage Schedules Button', 'backups', 'Manage backup schedules'),
('backups_filter_type', 'Backups Type Filter', 'backups', 'Use backup type filter'),
('backups_filter_date', 'Backups Date Filter', 'backups', 'Use date filter');

-- ======================== REPORTS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('reports_tab_inventory', 'Reports Inventory Tab', 'reports', 'Access to inventory reports tab'),
('reports_tab_inbound', 'Reports Inbound Tab', 'reports', 'Access to inbound reports tab'),
('reports_tab_outbound', 'Reports Outbound Tab', 'reports', 'Access to outbound reports tab'),
('reports_tab_picking', 'Reports Picking Tab', 'reports', 'Access to picking reports tab'),
('reports_tab_qc', 'Reports QC Tab', 'reports', 'Access to QC reports tab'),
('reports_btn_generate', 'Reports Generate Button', 'reports', 'Use generate report button'),
('reports_btn_export', 'Reports Export Button', 'reports', 'Use export button'),
('reports_btn_print', 'Reports Print Button', 'reports', 'Use print button'),
('reports_filter_daterange', 'Reports Date Range Filter', 'reports', 'Use date range filter'),
('reports_filter_warehouse', 'Reports Warehouse Filter', 'reports', 'Use warehouse filter');

-- ======================== PRINTERS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('printers_btn_add', 'Printers Add Button', 'printers', 'Use add printer button'),
('printers_btn_edit', 'Printers Edit Button', 'printers', 'Use edit button'),
('printers_btn_delete', 'Printers Delete Button', 'printers', 'Use delete button'),
('printers_btn_test', 'Printers Test Button', 'printers', 'Use test print button'),
('printers_btn_set_default', 'Printers Set Default Button', 'printers', 'Use set as default button');

-- ======================== PERMISSIONS PAGE ========================
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('permissions_tab_roles', 'Permissions Roles Tab', 'settings', 'Access to roles tab'),
('permissions_tab_users', 'Permissions Users Tab', 'settings', 'Access to user-specific permissions tab'),
('permissions_btn_save', 'Permissions Save Button', 'settings', 'Use save permissions button'),
('permissions_btn_reset', 'Permissions Reset Button', 'settings', 'Use reset to defaults button'),
('permissions_btn_export', 'Permissions Export Button', 'settings', 'Use export button'),
('permissions_filter_category', 'Permissions Category Filter', 'settings', 'Use category filter'),
('permissions_filter_search', 'Permissions Search Filter', 'settings', 'Use search filter');

-- ============================================================================
-- AUTO-ENABLE ALL NEW PERMISSIONS FOR ADMIN ROLE
-- ============================================================================
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'admin', permission_key, true
FROM permissions
WHERE permission_key LIKE '%_tab_%' 
   OR permission_key LIKE '%_btn_%' 
   OR permission_key LIKE '%_filter_%'
   OR permission_key LIKE '%_action_%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration adds granular UI permissions for:
-- - All tabs on every page
-- - All buttons (add, edit, delete, export, import, refresh, etc.)
-- - All filters (search, date, status, customer, warehouse, etc.)
-- - All actions (submit, approve, reject, etc.)
--
-- Total new permissions: ~180 granular UI permissions
-- These can be enabled/disabled individually for each role from the UI
-- ============================================================================
