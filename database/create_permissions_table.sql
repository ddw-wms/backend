-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_key)
);

-- Insert default permissions for all roles
-- Dashboard
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_dashboard', true),
('manager', 'view_dashboard', true),
('operator', 'view_dashboard', true),
('qc', 'view_dashboard', true),
('picker', 'view_dashboard', true);

-- Inbound Operations
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_inbound', true),
('admin', 'create_inbound', true),
('admin', 'edit_inbound', true),
('admin', 'delete_inbound', true),
('manager', 'view_inbound', true),
('manager', 'create_inbound', false),
('manager', 'edit_inbound', false),
('manager', 'delete_inbound', false),
('operator', 'view_inbound', true),
('operator', 'create_inbound', true),
('operator', 'edit_inbound', true),
('operator', 'delete_inbound', false),
('qc', 'view_inbound', false),
('qc', 'create_inbound', false),
('qc', 'edit_inbound', false),
('qc', 'delete_inbound', false),
('picker', 'view_inbound', false),
('picker', 'create_inbound', false),
('picker', 'edit_inbound', false),
('picker', 'delete_inbound', false);

-- Quality Control
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_qc', true),
('admin', 'create_qc', true),
('admin', 'approve_qc', true),
('manager', 'view_qc', true),
('manager', 'create_qc', false),
('manager', 'approve_qc', false),
('operator', 'view_qc', false),
('operator', 'create_qc', false),
('operator', 'approve_qc', false),
('qc', 'view_qc', true),
('qc', 'create_qc', true),
('qc', 'approve_qc', true),
('picker', 'view_qc', false),
('picker', 'create_qc', false),
('picker', 'approve_qc', false);

-- Picking Operations
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_picking', true),
('admin', 'create_picking', true),
('admin', 'complete_picking', true),
('manager', 'view_picking', true),
('manager', 'create_picking', false),
('manager', 'complete_picking', false),
('operator', 'view_picking', false),
('operator', 'create_picking', false),
('operator', 'complete_picking', false),
('qc', 'view_picking', false),
('qc', 'create_picking', false),
('qc', 'complete_picking', false),
('picker', 'view_picking', true),
('picker', 'create_picking', true),
('picker', 'complete_picking', true);

-- Outbound Operations
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_outbound', true),
('admin', 'create_outbound', true),
('admin', 'delete_outbound', true),
('manager', 'view_outbound', true),
('manager', 'create_outbound', false),
('manager', 'delete_outbound', false),
('operator', 'view_outbound', true),
('operator', 'create_outbound', true),
('operator', 'delete_outbound', false),
('qc', 'view_outbound', false),
('qc', 'create_outbound', false),
('qc', 'delete_outbound', false),
('picker', 'view_outbound', false),
('picker', 'create_outbound', false),
('picker', 'delete_outbound', false);

-- Customers
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_customers', true),
('admin', 'manage_customers', true),
('manager', 'view_customers', true),
('manager', 'manage_customers', false),
('operator', 'view_customers', true),
('operator', 'manage_customers', true),
('qc', 'view_customers', false),
('qc', 'manage_customers', false),
('picker', 'view_customers', true),
('picker', 'manage_customers', false);

-- Master Data & Reports
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'view_master_data', true),
('admin', 'edit_master_data', true),
('admin', 'view_reports', true),
('admin', 'export_reports', true),
('manager', 'view_master_data', true),
('manager', 'edit_master_data', false),
('manager', 'view_reports', true),
('manager', 'export_reports', true),
('operator', 'view_master_data', true),
('operator', 'edit_master_data', true),
('operator', 'view_reports', false),
('operator', 'export_reports', false),
('qc', 'view_master_data', false),
('qc', 'edit_master_data', false),
('qc', 'view_reports', false),
('qc', 'export_reports', false),
('picker', 'view_master_data', false),
('picker', 'edit_master_data', false),
('picker', 'view_reports', false),
('picker', 'export_reports', false);

-- System Administration
INSERT INTO role_permissions (role, permission_key, enabled) VALUES
('admin', 'manage_users', true),
('admin', 'manage_warehouses', true),
('admin', 'manage_racks', true),
('admin', 'manage_printers', true),
('admin', 'manage_permissions', true),
('manager', 'manage_users', false),
('manager', 'manage_warehouses', false),
('manager', 'manage_racks', false),
('manager', 'manage_printers', false),
('manager', 'manage_permissions', false),
('operator', 'manage_users', false),
('operator', 'manage_warehouses', false),
('operator', 'manage_racks', false),
('operator', 'manage_printers', false),
('operator', 'manage_permissions', false),
('qc', 'manage_users', false),
('qc', 'manage_warehouses', false),
('qc', 'manage_racks', false),
('qc', 'manage_printers', false),
('qc', 'manage_permissions', false),
('picker', 'manage_users', false),
('picker', 'manage_warehouses', false),
('picker', 'manage_racks', false),
('picker', 'manage_printers', false),
('picker', 'manage_permissions', false);

-- Create indexes for better performance
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_key ON role_permissions(permission_key);
CREATE INDEX idx_role_permissions_enabled ON role_permissions(enabled);
