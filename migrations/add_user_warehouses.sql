-- Migration: add_user_warehouses.sql

-- Create table to assign warehouses to users (explicit access grants)
CREATE TABLE IF NOT EXISTS user_warehouses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, warehouse_id)
);

-- Insert permissions for managing user warehouses (if not already present)
INSERT INTO permissions (permission_key, permission_name, category, description)
SELECT 'view_user_warehouses', 'View user warehouse assignments', 'users', 'View which warehouses a user has access to'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'view_user_warehouses');

INSERT INTO permissions (permission_key, permission_name, category, description)
SELECT 'edit_user_warehouses', 'Edit user warehouse assignments', 'users', 'Assign or remove warehouse access for a user'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'edit_user_warehouses');

-- Grant these permissions to the admin role by default
INSERT INTO role_permissions (role, permission_key, enabled)
SELECT 'admin', permission_key, true FROM permissions WHERE permission_key IN ('view_user_warehouses','edit_user_warehouses')
ON CONFLICT (role, permission_key) DO NOTHING;

-- Update triggers or last_updated is managed in app code; migrations may be extended as needed
