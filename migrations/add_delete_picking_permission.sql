-- Add missing delete_picking permission
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
('delete_picking', 'Delete Picking', 'picking', 'Delete picking batches and tasks')
ON CONFLICT (permission_key) DO NOTHING;

-- Give admin and manager access to this permission by default
INSERT INTO role_permissions (role, permission_key, enabled)
VALUES
('admin', 'delete_picking', true),
('manager', 'delete_picking', true)
ON CONFLICT (role, permission_key) DO NOTHING;