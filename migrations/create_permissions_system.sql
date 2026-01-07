-- Permissions System Setup
-- This creates a comprehensive permission system for WMS app

-- 1. Create permissions table (master list of all available permissions)
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    permission_key VARCHAR(100) UNIQUE NOT NULL,
    permission_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,  -- e.g., 'dashboard', 'inbound', 'outbound', etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create role_permissions table (assigns permissions to roles)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,  -- admin, manager, operator, qc, picker
    permission_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role, permission_key),
    FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE
);

-- 3. Create user_permissions table (custom permissions for specific users, overrides role permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, permission_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE
);

-- Insert all available permissions for the WMS system

-- Dashboard Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_dashboard', 'View Dashboard', 'dashboard', 'Access to dashboard page'),
('view_dashboard_stats', 'View Dashboard Statistics', 'dashboard', 'View statistics and KPIs'),
('view_dashboard_charts', 'View Dashboard Charts', 'dashboard', 'View charts and graphs'),
('export_dashboard', 'Export Dashboard Data', 'dashboard', 'Export dashboard data');

-- Inbound Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_inbound', 'View Inbound', 'inbound', 'Access to inbound page'),
('create_inbound', 'Create Inbound', 'inbound', 'Create new inbound orders'),
('edit_inbound', 'Edit Inbound', 'inbound', 'Edit existing inbound orders'),
('delete_inbound', 'Delete Inbound', 'inbound', 'Delete inbound orders'),
('receive_inbound', 'Receive Inbound', 'inbound', 'Mark items as received'),
('export_inbound', 'Export Inbound Data', 'inbound', 'Export inbound data'),
('import_inbound', 'Import Inbound Data', 'inbound', 'Import inbound data from file');

-- Outbound Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_outbound', 'View Outbound', 'outbound', 'Access to outbound page'),
('create_outbound', 'Create Outbound', 'outbound', 'Create new outbound orders'),
('edit_outbound', 'Edit Outbound', 'outbound', 'Edit existing outbound orders'),
('delete_outbound', 'Delete Outbound', 'outbound', 'Delete outbound orders'),
('dispatch_outbound', 'Dispatch Outbound', 'outbound', 'Mark orders as dispatched'),
('export_outbound', 'Export Outbound Data', 'outbound', 'Export outbound data'),
('import_outbound', 'Import Outbound Data', 'outbound', 'Import outbound data from file');

-- Inventory Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_inventory', 'View Inventory', 'inventory', 'Access to inventory page'),
('adjust_inventory', 'Adjust Inventory', 'inventory', 'Adjust inventory quantities'),
('move_inventory', 'Move Inventory', 'inventory', 'Move items between locations'),
('export_inventory', 'Export Inventory Data', 'inventory', 'Export inventory data'),
('import_inventory', 'Import Inventory Data', 'inventory', 'Import inventory data');

-- Picking Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_picking', 'View Picking', 'picking', 'Access to picking page'),
('create_picking', 'Create Picking Task', 'picking', 'Create new picking tasks'),
('edit_picking', 'Edit Picking', 'picking', 'Edit picking tasks'),
('complete_picking', 'Complete Picking', 'picking', 'Mark picking as complete'),
('cancel_picking', 'Cancel Picking', 'picking', 'Cancel picking tasks'),
('export_picking', 'Export Picking Data', 'picking', 'Export picking data');

-- QC Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_qc', 'View QC', 'qc', 'Access to QC page'),
('create_qc', 'Create QC Check', 'qc', 'Create QC inspections'),
('edit_qc', 'Edit QC', 'qc', 'Edit QC inspections'),
('approve_qc', 'Approve QC', 'qc', 'Approve items in QC'),
('reject_qc', 'Reject QC', 'qc', 'Reject items in QC'),
('delete_qc', 'Delete QC', 'qc', 'Delete QC records'),
('export_qc', 'Export QC Data', 'qc', 'Export QC data');

-- Reports Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_reports', 'View Reports', 'reports', 'Access to reports page'),
('generate_inventory_report', 'Generate Inventory Report', 'reports', 'Generate inventory reports'),
('generate_inbound_report', 'Generate Inbound Report', 'reports', 'Generate inbound reports'),
('generate_outbound_report', 'Generate Outbound Report', 'reports', 'Generate outbound reports'),
('generate_picking_report', 'Generate Picking Report', 'reports', 'Generate picking reports'),
('export_reports', 'Export Reports', 'reports', 'Export report data');

-- Customer Management Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_customers', 'View Customers', 'customers', 'Access to customers page'),
('create_customer', 'Create Customer', 'customers', 'Create new customers'),
('edit_customer', 'Edit Customer', 'customers', 'Edit customer details'),
('delete_customer', 'Delete Customer', 'customers', 'Delete customers'),
('export_customers', 'Export Customer Data', 'customers', 'Export customer data');

-- Master Data Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_master_data', 'View Master Data', 'master-data', 'Access to master data settings'),
('manage_products', 'Manage Products', 'master-data', 'Create/Edit/Delete products'),
('manage_locations', 'Manage Locations', 'master-data', 'Create/Edit/Delete locations'),
('manage_categories', 'Manage Categories', 'master-data', 'Create/Edit/Delete categories'),
('export_master_data', 'Export Master Data', 'master-data', 'Export master data');

-- Warehouse Management Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_warehouses', 'View Warehouses', 'warehouses', 'Access to warehouse settings'),
('create_warehouse', 'Create Warehouse', 'warehouses', 'Create new warehouses'),
('edit_warehouse', 'Edit Warehouse', 'warehouses', 'Edit warehouse details'),
('delete_warehouse', 'Delete Warehouse', 'warehouses', 'Delete warehouses');

-- Rack Management Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_racks', 'View Racks', 'racks', 'Access to rack management'),
('create_rack', 'Create Rack', 'racks', 'Create new racks'),
('edit_rack', 'Edit Rack', 'racks', 'Edit rack details'),
('delete_rack', 'Delete Rack', 'racks', 'Delete racks');

-- User Management Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_users', 'View Users', 'users', 'Access to user management'),
('create_user', 'Create User', 'users', 'Create new users'),
('edit_user', 'Edit User', 'users', 'Edit user details'),
('delete_user', 'Delete User', 'users', 'Delete users'),
('reset_password', 'Reset Password', 'users', 'Reset user passwords');

-- Backup Management Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_backups', 'View Backups', 'backups', 'Access to backup settings'),
('create_backup', 'Create Backup', 'backups', 'Create manual backups'),
('restore_backup', 'Restore Backup', 'backups', 'Restore from backups'),
('delete_backup', 'Delete Backup', 'backups', 'Delete backup files'),
('configure_backup', 'Configure Backup Settings', 'backups', 'Configure backup schedules');

-- Printer Management Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_printers', 'View Printers', 'printers', 'Access to printer settings'),
('manage_printers', 'Manage Printers', 'printers', 'Add/Edit/Delete printers'),
('print_labels', 'Print Labels', 'printers', 'Print labels and barcodes');

-- System Settings Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('view_settings', 'View Settings', 'settings', 'Access to system settings'),
('manage_settings', 'Manage Settings', 'settings', 'Modify system settings'),
('view_permissions', 'View Permissions', 'settings', 'Access to permission settings'),
('manage_permissions', 'Manage Permissions', 'settings', 'Modify permission settings');

-- Insert default role permissions (Admin has all permissions)
-- We'll insert admin permissions for all permissions dynamically
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'admin', permission_key, true
FROM permissions
ON CONFLICT (role, permission_key) DO NOTHING;

-- Manager default permissions (most permissions except user management and system settings)
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'manager', permission_key, true
FROM permissions
WHERE category IN ('dashboard', 'inbound', 'outbound', 'inventory', 'picking', 'qc', 'reports', 'customers', 'master-data', 'warehouses', 'racks')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Operator default permissions (basic operations)
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'operator', permission_key, true
FROM permissions
WHERE permission_key IN (
    'view_dashboard', 'view_dashboard_stats',
    'view_inbound', 'receive_inbound',
    'view_outbound', 'dispatch_outbound',
    'view_inventory',
    'view_picking', 'complete_picking',
    'view_customers',
    'print_labels'
)
ON CONFLICT (role, permission_key) DO NOTHING;

-- QC role default permissions
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'qc', permission_key, true
FROM permissions
WHERE permission_key IN (
    'view_dashboard', 'view_dashboard_stats',
    'view_qc', 'create_qc', 'edit_qc', 'approve_qc', 'reject_qc', 'export_qc',
    'view_inventory',
    'view_inbound',
    'print_labels'
)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Picker role default permissions
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'picker', permission_key, true
FROM permissions
WHERE permission_key IN (
    'view_dashboard', 'view_dashboard_stats',
    'view_picking', 'complete_picking',
    'view_inventory',
    'view_outbound',
    'print_labels'
)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_enabled ON role_permissions(enabled);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- Add updated_at trigger for role_permissions
CREATE OR REPLACE FUNCTION update_role_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_role_permissions_timestamp
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_role_permissions_timestamp();

-- Add updated_at trigger for user_permissions
CREATE OR REPLACE FUNCTION update_user_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_permissions_timestamp
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_permissions_timestamp();

-- Grant permissions to database user
GRANT ALL PRIVILEGES ON permissions TO postgres;
GRANT ALL PRIVILEGES ON role_permissions TO postgres;
GRANT ALL PRIVILEGES ON user_permissions TO postgres;
GRANT USAGE, SELECT ON SEQUENCE permissions_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE role_permissions_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE user_permissions_id_seq TO postgres;

-- Done!
