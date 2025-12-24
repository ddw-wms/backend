-- ========================================
-- COMPREHENSIVE PERMISSIONS TABLE
-- All actions from all pages
-- ========================================

-- Drop existing table and create new one
DROP TABLE IF EXISTS role_permissions CASCADE;

CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_key)
);

-- ========================================
-- INBOUND MODULE (14 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View inbound page
('admin', 'view_inbound', true), ('manager', 'view_inbound', true), ('operator', 'view_inbound', true), ('qc', 'view_inbound', false), ('picker', 'view_inbound', false),
-- Single entry
('admin', 'create_inbound_single', true), ('manager', 'create_inbound_single', false), ('operator', 'create_inbound_single', true), ('qc', 'create_inbound_single', false), ('picker', 'create_inbound_single', false),
-- Bulk upload
('admin', 'upload_inbound_bulk', true), ('manager', 'upload_inbound_bulk', false), ('operator', 'upload_inbound_bulk', true), ('qc', 'upload_inbound_bulk', false), ('picker', 'upload_inbound_bulk', false),
-- Multi entry
('admin', 'create_inbound_multi', true), ('manager', 'create_inbound_multi', false), ('operator', 'create_inbound_multi', true), ('qc', 'create_inbound_multi', false), ('picker', 'create_inbound_multi', false),
-- List operations
('admin', 'view_inbound_list', true), ('manager', 'view_inbound_list', true), ('operator', 'view_inbound_list', true), ('qc', 'view_inbound_list', false), ('picker', 'view_inbound_list', false),
('admin', 'export_inbound', true), ('manager', 'export_inbound', true), ('operator', 'export_inbound', false), ('qc', 'export_inbound', false), ('picker', 'export_inbound', false),
('admin', 'delete_inbound', true), ('manager', 'delete_inbound', false), ('operator', 'delete_inbound', false), ('qc', 'delete_inbound', false), ('picker', 'delete_inbound', false),
('admin', 'refresh_inbound', true), ('manager', 'refresh_inbound', true), ('operator', 'refresh_inbound', true), ('qc', 'refresh_inbound', false), ('picker', 'refresh_inbound', false),
-- Print labels
('admin', 'print_inbound_label', true), ('manager', 'print_inbound_label', false), ('operator', 'print_inbound_label', true), ('qc', 'print_inbound_label', false), ('picker', 'print_inbound_label', false),
-- Column settings
('admin', 'inbound_column_settings', true), ('manager', 'inbound_column_settings', true), ('operator', 'inbound_column_settings', true), ('qc', 'inbound_column_settings', false), ('picker', 'inbound_column_settings', false),
-- Filter settings
('admin', 'filter_inbound', true), ('manager', 'filter_inbound', true), ('operator', 'filter_inbound', true), ('qc', 'filter_inbound', false), ('picker', 'filter_inbound', false),
-- Pagination
('admin', 'paginate_inbound', true), ('manager', 'paginate_inbound', true), ('operator', 'paginate_inbound', true), ('qc', 'paginate_inbound', false), ('picker', 'paginate_inbound', false),
-- Download templates
('admin', 'download_inbound_template', true), ('manager', 'download_inbound_template', true), ('operator', 'download_inbound_template', true), ('qc', 'download_inbound_template', false), ('picker', 'download_inbound_template', false),
-- View master data columns
('admin', 'view_inbound_master_columns', true), ('manager', 'view_inbound_master_columns', true), ('operator', 'view_inbound_master_columns', true), ('qc', 'view_inbound_master_columns', false), ('picker', 'view_inbound_master_columns', false);

-- ========================================
-- QUALITY CONTROL (QC) MODULE (16 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View QC page
('admin', 'view_qc', true), ('manager', 'view_qc', true), ('operator', 'view_qc', false), ('qc', 'view_qc', true), ('picker', 'view_qc', false),
-- Single QC entry
('admin', 'create_qc_single', true), ('manager', 'create_qc_single', false), ('operator', 'create_qc_single', false), ('qc', 'create_qc_single', true), ('picker', 'create_qc_single', false),
-- Multi QC entry
('admin', 'create_qc_multi', true), ('manager', 'create_qc_multi', false), ('operator', 'create_qc_multi', false), ('qc', 'create_qc_multi', true), ('picker', 'create_qc_multi', false),
-- Bulk QC upload
('admin', 'upload_qc_bulk', true), ('manager', 'upload_qc_bulk', false), ('operator', 'upload_qc_bulk', false), ('qc', 'upload_qc_bulk', true), ('picker', 'upload_qc_bulk', false),
-- Edit QC
('admin', 'edit_qc', true), ('manager', 'edit_qc', false), ('operator', 'edit_qc', false), ('qc', 'edit_qc', true), ('picker', 'edit_qc', false),
-- Delete QC
('admin', 'delete_qc', true), ('manager', 'delete_qc', false), ('operator', 'delete_qc', false), ('qc', 'delete_qc', false), ('picker', 'delete_qc', false),
-- Approve QC
('admin', 'approve_qc', true), ('manager', 'approve_qc', true), ('operator', 'approve_qc', false), ('qc', 'approve_qc', true), ('picker', 'approve_qc', false),
-- View QC list
('admin', 'view_qc_list', true), ('manager', 'view_qc_list', true), ('operator', 'view_qc_list', false), ('qc', 'view_qc_list', true), ('picker', 'view_qc_list', false),
-- Export QC
('admin', 'export_qc', true), ('manager', 'export_qc', true), ('operator', 'export_qc', false), ('qc', 'export_qc', true), ('picker', 'export_qc', false),
-- Refresh QC
('admin', 'refresh_qc', true), ('manager', 'refresh_qc', true), ('operator', 'refresh_qc', false), ('qc', 'refresh_qc', true), ('picker', 'refresh_qc', false),
-- QC column settings
('admin', 'qc_column_settings', true), ('manager', 'qc_column_settings', true), ('operator', 'qc_column_settings', false), ('qc', 'qc_column_settings', true), ('picker', 'qc_column_settings', false),
-- Filter QC
('admin', 'filter_qc', true), ('manager', 'filter_qc', true), ('operator', 'filter_qc', false), ('qc', 'filter_qc', true), ('picker', 'filter_qc', false),
-- View QC stats
('admin', 'view_qc_stats', true), ('manager', 'view_qc_stats', true), ('operator', 'view_qc_stats', false), ('qc', 'view_qc_stats', true), ('picker', 'view_qc_stats', false),
-- Download QC template
('admin', 'download_qc_template', true), ('manager', 'download_qc_template', true), ('operator', 'download_qc_template', false), ('qc', 'download_qc_template', true), ('picker', 'download_qc_template', false),
-- Change QC grade
('admin', 'change_qc_grade', true), ('manager', 'change_qc_grade', false), ('operator', 'change_qc_grade', false), ('qc', 'change_qc_grade', true), ('picker', 'change_qc_grade', false),
-- View QC history
('admin', 'view_qc_history', true), ('manager', 'view_qc_history', true), ('operator', 'view_qc_history', false), ('qc', 'view_qc_history', true), ('picker', 'view_qc_history', false);

-- ========================================
-- PICKING MODULE (13 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View picking page
('admin', 'view_picking', true), ('manager', 'view_picking', true), ('operator', 'view_picking', false), ('qc', 'view_picking', false), ('picker', 'view_picking', true),
-- Create picking multi
('admin', 'create_picking_multi', true), ('manager', 'create_picking_multi', false), ('operator', 'create_picking_multi', false), ('qc', 'create_picking_multi', false), ('picker', 'create_picking_multi', true),
-- Complete picking
('admin', 'complete_picking', true), ('manager', 'complete_picking', false), ('operator', 'complete_picking', false), ('qc', 'complete_picking', false), ('picker', 'complete_picking', true),
-- View picking list
('admin', 'view_picking_list', true), ('manager', 'view_picking_list', true), ('operator', 'view_picking_list', false), ('qc', 'view_picking_list', false), ('picker', 'view_picking_list', true),
-- Export picking
('admin', 'export_picking', true), ('manager', 'export_picking', true), ('operator', 'export_picking', false), ('qc', 'export_picking', false), ('picker', 'export_picking', false),
-- Delete picking
('admin', 'delete_picking', true), ('manager', 'delete_picking', false), ('operator', 'delete_picking', false), ('qc', 'delete_picking', false), ('picker', 'delete_picking', false),
-- Refresh picking
('admin', 'refresh_picking', true), ('manager', 'refresh_picking', true), ('operator', 'refresh_picking', false), ('qc', 'refresh_picking', false), ('picker', 'refresh_picking', true),
-- Picking column settings
('admin', 'picking_column_settings', true), ('manager', 'picking_column_settings', true), ('operator', 'picking_column_settings', false), ('qc', 'picking_column_settings', false), ('picker', 'picking_column_settings', true),
-- Filter picking
('admin', 'filter_picking', true), ('manager', 'filter_picking', true), ('operator', 'filter_picking', false), ('qc', 'filter_picking', false), ('picker', 'filter_picking', true),
-- Select customer for picking
('admin', 'select_picking_customer', true), ('manager', 'select_picking_customer', false), ('operator', 'select_picking_customer', false), ('qc', 'select_picking_customer', false), ('picker', 'select_picking_customer', true),
-- View picking details
('admin', 'view_picking_details', true), ('manager', 'view_picking_details', true), ('operator', 'view_picking_details', false), ('qc', 'view_picking_details', false), ('picker', 'view_picking_details', true),
-- Edit picking
('admin', 'edit_picking', true), ('manager', 'edit_picking', false), ('operator', 'edit_picking', false), ('qc', 'edit_picking', false), ('picker', 'edit_picking', true),
-- Download picking template
('admin', 'download_picking_template', true), ('manager', 'download_picking_template', false), ('operator', 'download_picking_template', false), ('qc', 'download_picking_template', false), ('picker', 'download_picking_template', true);

-- ========================================
-- OUTBOUND MODULE (14 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View outbound page
('admin', 'view_outbound', true), ('manager', 'view_outbound', true), ('operator', 'view_outbound', true), ('qc', 'view_outbound', false), ('picker', 'view_outbound', false),
-- Create outbound multi
('admin', 'create_outbound_multi', true), ('manager', 'create_outbound_multi', false), ('operator', 'create_outbound_multi', true), ('qc', 'create_outbound_multi', false), ('picker', 'create_outbound_multi', false),
-- Bulk upload outbound
('admin', 'upload_outbound_bulk', true), ('manager', 'upload_outbound_bulk', false), ('operator', 'upload_outbound_bulk', true), ('qc', 'upload_outbound_bulk', false), ('picker', 'upload_outbound_bulk', false),
-- View outbound list
('admin', 'view_outbound_list', true), ('manager', 'view_outbound_list', true), ('operator', 'view_outbound_list', true), ('qc', 'view_outbound_list', false), ('picker', 'view_outbound_list', false),
-- Export outbound
('admin', 'export_outbound', true), ('manager', 'export_outbound', true), ('operator', 'export_outbound', false), ('qc', 'export_outbound', false), ('picker', 'export_outbound', false),
-- Delete outbound
('admin', 'delete_outbound', true), ('manager', 'delete_outbound', false), ('operator', 'delete_outbound', false), ('qc', 'delete_outbound', false), ('picker', 'delete_outbound', false),
-- Refresh outbound
('admin', 'refresh_outbound', true), ('manager', 'refresh_outbound', true), ('operator', 'refresh_outbound', true), ('qc', 'refresh_outbound', false), ('picker', 'refresh_outbound', false),
-- Outbound column settings
('admin', 'outbound_column_settings', true), ('manager', 'outbound_column_settings', true), ('operator', 'outbound_column_settings', true), ('qc', 'outbound_column_settings', false), ('picker', 'outbound_column_settings', false),
-- Filter outbound
('admin', 'filter_outbound', true), ('manager', 'filter_outbound', true), ('operator', 'filter_outbound', true), ('qc', 'filter_outbound', false), ('picker', 'filter_outbound', false),
-- Select customer for outbound
('admin', 'select_outbound_customer', true), ('manager', 'select_outbound_customer', false), ('operator', 'select_outbound_customer', true), ('qc', 'select_outbound_customer', false), ('picker', 'select_outbound_customer', false),
-- View outbound stats
('admin', 'view_outbound_stats', true), ('manager', 'view_outbound_stats', true), ('operator', 'view_outbound_stats', false), ('qc', 'view_outbound_stats', false), ('picker', 'view_outbound_stats', false),
-- Download outbound template
('admin', 'download_outbound_template', true), ('manager', 'download_outbound_template', true), ('operator', 'download_outbound_template', true), ('qc', 'download_outbound_template', false), ('picker', 'download_outbound_template', false),
-- Edit outbound
('admin', 'edit_outbound', true), ('manager', 'edit_outbound', false), ('operator', 'edit_outbound', true), ('qc', 'edit_outbound', false), ('picker', 'edit_outbound', false),
-- View outbound details
('admin', 'view_outbound_details', true), ('manager', 'view_outbound_details', true), ('operator', 'view_outbound_details', true), ('qc', 'view_outbound_details', false), ('picker', 'view_outbound_details', false);

-- ========================================
-- CUSTOMERS MODULE (5 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View customers page
('admin', 'view_customers', true), ('manager', 'view_customers', true), ('operator', 'view_customers', true), ('qc', 'view_customers', false), ('picker', 'view_customers', true),
-- Create customer
('admin', 'create_customer', true), ('manager', 'create_customer', false), ('operator', 'create_customer', true), ('qc', 'create_customer', false), ('picker', 'create_customer', false),
-- Edit customer
('admin', 'edit_customer', true), ('manager', 'edit_customer', false), ('operator', 'edit_customer', true), ('qc', 'edit_customer', false), ('picker', 'edit_customer', false),
-- Delete customer
('admin', 'delete_customer', true), ('manager', 'delete_customer', false), ('operator', 'delete_customer', false), ('qc', 'delete_customer', false), ('picker', 'delete_customer', false),
-- View customer details
('admin', 'view_customer_details', true), ('manager', 'view_customer_details', true), ('operator', 'view_customer_details', true), ('qc', 'view_customer_details', false), ('picker', 'view_customer_details', true);

-- ========================================
-- DASHBOARD MODULE (8 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View dashboard page
('admin', 'view_dashboard', true), ('manager', 'view_dashboard', true), ('operator', 'view_dashboard', true), ('qc', 'view_dashboard', true), ('picker', 'view_dashboard', true),
-- View dashboard stats
('admin', 'view_dashboard_stats', true), ('manager', 'view_dashboard_stats', true), ('operator', 'view_dashboard_stats', true), ('qc', 'view_dashboard_stats', false), ('picker', 'view_dashboard_stats', false),
-- Export dashboard data
('admin', 'export_dashboard', true), ('manager', 'export_dashboard', true), ('operator', 'export_dashboard', false), ('qc', 'export_dashboard', false), ('picker', 'export_dashboard', false),
-- View inventory details
('admin', 'view_inventory_details', true), ('manager', 'view_inventory_details', true), ('operator', 'view_inventory_details', true), ('qc', 'view_inventory_details', false), ('picker', 'view_inventory_details', false),
-- Filter dashboard
('admin', 'filter_dashboard', true), ('manager', 'filter_dashboard', true), ('operator', 'filter_dashboard', true), ('qc', 'filter_dashboard', false), ('picker', 'filter_dashboard', false),
-- Refresh dashboard
('admin', 'refresh_dashboard', true), ('manager', 'refresh_dashboard', true), ('operator', 'refresh_dashboard', true), ('qc', 'refresh_dashboard', true), ('picker', 'refresh_dashboard', true),
-- View recent activities
('admin', 'view_recent_activities', true), ('manager', 'view_recent_activities', true), ('operator', 'view_recent_activities', false), ('qc', 'view_recent_activities', false), ('picker', 'view_recent_activities', false),
-- Print dashboard label
('admin', 'print_dashboard_label', true), ('manager', 'print_dashboard_label', false), ('operator', 'print_dashboard_label', false), ('qc', 'print_dashboard_label', false), ('picker', 'print_dashboard_label', false);

-- ========================================
-- MASTER DATA MODULE (11 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View master data page
('admin', 'view_master_data', true), ('manager', 'view_master_data', true), ('operator', 'view_master_data', true), ('qc', 'view_master_data', false), ('picker', 'view_master_data', false),
-- Upload master data
('admin', 'upload_master_data', true), ('manager', 'upload_master_data', false), ('operator', 'upload_master_data', true), ('qc', 'upload_master_data', false), ('picker', 'upload_master_data', false),
-- Export master data
('admin', 'export_master_data', true), ('manager', 'export_master_data', true), ('operator', 'export_master_data', false), ('qc', 'export_master_data', false), ('picker', 'export_master_data', false),
-- Delete master data
('admin', 'delete_master_data', true), ('manager', 'delete_master_data', false), ('operator', 'delete_master_data', false), ('qc', 'delete_master_data', false), ('picker', 'delete_master_data', false),
-- Refresh master data
('admin', 'refresh_master_data', true), ('manager', 'refresh_master_data', true), ('operator', 'refresh_master_data', true), ('qc', 'refresh_master_data', false), ('picker', 'refresh_master_data', false),
-- Master data column settings
('admin', 'master_data_column_settings', true), ('manager', 'master_data_column_settings', true), ('operator', 'master_data_column_settings', true), ('qc', 'master_data_column_settings', false), ('picker', 'master_data_column_settings', false),
-- Filter master data
('admin', 'filter_master_data', true), ('manager', 'filter_master_data', true), ('operator', 'filter_master_data', true), ('qc', 'filter_master_data', false), ('picker', 'filter_master_data', false),
-- Download master data template
('admin', 'download_master_data_template', true), ('manager', 'download_master_data_template', true), ('operator', 'download_master_data_template', true), ('qc', 'download_master_data_template', false), ('picker', 'download_master_data_template', false),
-- View master data stats
('admin', 'view_master_data_stats', true), ('manager', 'view_master_data_stats', true), ('operator', 'view_master_data_stats', false), ('qc', 'view_master_data_stats', false), ('picker', 'view_master_data_stats', false),
-- Edit master data
('admin', 'edit_master_data', true), ('manager', 'edit_master_data', false), ('operator', 'edit_master_data', true), ('qc', 'edit_master_data', false), ('picker', 'edit_master_data', false),
-- Bulk delete master data
('admin', 'bulk_delete_master_data', true), ('manager', 'bulk_delete_master_data', false), ('operator', 'bulk_delete_master_data', false), ('qc', 'bulk_delete_master_data', false), ('picker', 'bulk_delete_master_data', false);

-- ========================================
-- USERS MODULE (5 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View users page
('admin', 'view_users', true), ('manager', 'view_users', false), ('operator', 'view_users', false), ('qc', 'view_users', false), ('picker', 'view_users', false),
-- Create user
('admin', 'create_user', true), ('manager', 'create_user', false), ('operator', 'create_user', false), ('qc', 'create_user', false), ('picker', 'create_user', false),
-- Edit user
('admin', 'edit_user', true), ('manager', 'edit_user', false), ('operator', 'edit_user', false), ('qc', 'edit_user', false), ('picker', 'edit_user', false),
-- Delete user
('admin', 'delete_user', true), ('manager', 'delete_user', false), ('operator', 'delete_user', false), ('qc', 'delete_user', false), ('picker', 'delete_user', false),
-- Toggle user status
('admin', 'toggle_user_status', true), ('manager', 'toggle_user_status', false), ('operator', 'toggle_user_status', false), ('qc', 'toggle_user_status', false), ('picker', 'toggle_user_status', false);

-- ========================================
-- WAREHOUSES MODULE (6 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View warehouses page
('admin', 'view_warehouses', true), ('manager', 'view_warehouses', false), ('operator', 'view_warehouses', false), ('qc', 'view_warehouses', false), ('picker', 'view_warehouses', false),
-- Create warehouse
('admin', 'create_warehouse', true), ('manager', 'create_warehouse', false), ('operator', 'create_warehouse', false), ('qc', 'create_warehouse', false), ('picker', 'create_warehouse', false),
-- Edit warehouse
('admin', 'edit_warehouse', true), ('manager', 'edit_warehouse', false), ('operator', 'edit_warehouse', false), ('qc', 'edit_warehouse', false), ('picker', 'edit_warehouse', false),
-- Delete warehouse
('admin', 'delete_warehouse', true), ('manager', 'delete_warehouse', false), ('operator', 'delete_warehouse', false), ('qc', 'delete_warehouse', false), ('picker', 'delete_warehouse', false),
-- Set active warehouse
('admin', 'set_active_warehouse', true), ('manager', 'set_active_warehouse', false), ('operator', 'set_active_warehouse', false), ('qc', 'set_active_warehouse', false), ('picker', 'set_active_warehouse', false),
-- View warehouse details
('admin', 'view_warehouse_details', true), ('manager', 'view_warehouse_details', false), ('operator', 'view_warehouse_details', false), ('qc', 'view_warehouse_details', false), ('picker', 'view_warehouse_details', false);

-- ========================================
-- RACKS MODULE (7 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View racks page
('admin', 'view_racks', true), ('manager', 'view_racks', false), ('operator', 'view_racks', false), ('qc', 'view_racks', false), ('picker', 'view_racks', false),
-- Create rack
('admin', 'create_rack', true), ('manager', 'create_rack', false), ('operator', 'create_rack', false), ('qc', 'create_rack', false), ('picker', 'create_rack', false),
-- Edit rack
('admin', 'edit_rack', true), ('manager', 'edit_rack', false), ('operator', 'edit_rack', false), ('qc', 'edit_rack', false), ('picker', 'edit_rack', false),
-- Delete rack
('admin', 'delete_rack', true), ('manager', 'delete_rack', false), ('operator', 'delete_rack', false), ('qc', 'delete_rack', false), ('picker', 'delete_rack', false),
-- Toggle rack status
('admin', 'toggle_rack_status', true), ('manager', 'toggle_rack_status', false), ('operator', 'toggle_rack_status', false), ('qc', 'toggle_rack_status', false), ('picker', 'toggle_rack_status', false),
-- Bulk upload racks
('admin', 'upload_racks_bulk', true), ('manager', 'upload_racks_bulk', false), ('operator', 'upload_racks_bulk', false), ('qc', 'upload_racks_bulk', false), ('picker', 'upload_racks_bulk', false),
-- Download racks template
('admin', 'download_racks_template', true), ('manager', 'download_racks_template', false), ('operator', 'download_racks_template', false), ('qc', 'download_racks_template', false), ('picker', 'download_racks_template', false);

-- ========================================
-- PRINTERS MODULE (9 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View printers page
('admin', 'view_printers', true), ('manager', 'view_printers', false), ('operator', 'view_printers', false), ('qc', 'view_printers', false), ('picker', 'view_printers', false),
-- Save printer settings
('admin', 'save_printer_settings', true), ('manager', 'save_printer_settings', false), ('operator', 'save_printer_settings', false), ('qc', 'save_printer_settings', false), ('picker', 'save_printer_settings', false),
-- Test print
('admin', 'test_print', true), ('manager', 'test_print', false), ('operator', 'test_print', false), ('qc', 'test_print', false), ('picker', 'test_print', false),
-- Refresh printers
('admin', 'refresh_printers', true), ('manager', 'refresh_printers', false), ('operator', 'refresh_printers', false), ('qc', 'refresh_printers', false), ('picker', 'refresh_printers', false),
-- Restart print agent
('admin', 'restart_print_agent', true), ('manager', 'restart_print_agent', false), ('operator', 'restart_print_agent', false), ('qc', 'restart_print_agent', false), ('picker', 'restart_print_agent', false),
-- View printer status
('admin', 'view_printer_status', true), ('manager', 'view_printer_status', false), ('operator', 'view_printer_status', false), ('qc', 'view_printer_status', false), ('picker', 'view_printer_status', false),
-- Change printer settings
('admin', 'change_printer_settings', true), ('manager', 'change_printer_settings', false), ('operator', 'change_printer_settings', false), ('qc', 'change_printer_settings', false), ('picker', 'change_printer_settings', false),
-- View print history
('admin', 'view_print_history', true), ('manager', 'view_print_history', false), ('operator', 'view_print_history', false), ('qc', 'view_print_history', false), ('picker', 'view_print_history', false),
-- Reset printer settings
('admin', 'reset_printer_settings', true), ('manager', 'reset_printer_settings', false), ('operator', 'reset_printer_settings', false), ('qc', 'reset_printer_settings', false), ('picker', 'reset_printer_settings', false);

-- ========================================
-- PERMISSIONS MODULE (4 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View permissions page
('admin', 'view_permissions', true), ('manager', 'view_permissions', false), ('operator', 'view_permissions', false), ('qc', 'view_permissions', false), ('picker', 'view_permissions', false),
-- Edit permissions
('admin', 'edit_permissions', true), ('manager', 'edit_permissions', false), ('operator', 'edit_permissions', false), ('qc', 'edit_permissions', false), ('picker', 'edit_permissions', false),
-- Save permissions
('admin', 'save_permissions', true), ('manager', 'save_permissions', false), ('operator', 'save_permissions', false), ('qc', 'save_permissions', false), ('picker', 'save_permissions', false),
-- Reset permissions
('admin', 'reset_permissions', true), ('manager', 'reset_permissions', false), ('operator', 'reset_permissions', false), ('qc', 'reset_permissions', false), ('picker', 'reset_permissions', false);

-- ========================================
-- REPORTS MODULE (5 permissions)
-- ========================================
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
-- View reports page
('admin', 'view_reports', true), ('manager', 'view_reports', true), ('operator', 'view_reports', false), ('qc', 'view_reports', false), ('picker', 'view_reports', false),
-- Generate reports
('admin', 'generate_reports', true), ('manager', 'generate_reports', true), ('operator', 'generate_reports', false), ('qc', 'generate_reports', false), ('picker', 'generate_reports', false),
-- Export reports
('admin', 'export_reports', true), ('manager', 'export_reports', true), ('operator', 'export_reports', false), ('qc', 'export_reports', false), ('picker', 'export_reports', false),
-- Schedule reports
('admin', 'schedule_reports', true), ('manager', 'schedule_reports', false), ('operator', 'schedule_reports', false), ('qc', 'schedule_reports', false), ('picker', 'schedule_reports', false),
-- View report history
('admin', 'view_report_history', true), ('manager', 'view_report_history', true), ('operator', 'view_report_history', false), ('qc', 'view_report_history', false), ('picker', 'view_report_history', false);

-- Create indexes for better performance
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_key ON role_permissions(permission_key);
CREATE INDEX idx_role_permissions_enabled ON role_permissions(enabled);
CREATE INDEX idx_role_permissions_role_key ON role_permissions(role, permission_key);

-- Summary: 
-- Total Permissions: 116 unique permission keys
-- Total Records: 580 (116 permissions × 5 roles)
-- Modules: 12 (Inbound, QC, Picking, Outbound, Customers, Dashboard, Master Data, Users, Warehouses, Racks, Printers, Permissions, Reports)
