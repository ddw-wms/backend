-- Permission Approval System
-- This creates tables for permission change approval workflow
-- Admin/Manager changes need Super Admin approval

-- ============================================================================
-- 1. CREATE PERMISSION CHANGE REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS permission_change_requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('role', 'user_override')),
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partially_approved')),
    reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Either role_id or target_user_id must be set based on request_type
    CONSTRAINT valid_request_target CHECK (
        (request_type = 'role' AND role_id IS NOT NULL AND target_user_id IS NULL) OR
        (request_type = 'user_override' AND target_user_id IS NOT NULL)
    )
);

-- ============================================================================
-- 2. CREATE PERMISSION CHANGE DETAILS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS permission_change_details (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES permission_change_requests(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL,
    old_is_enabled BOOLEAN,
    new_is_enabled BOOLEAN,
    old_is_visible BOOLEAN,
    new_is_visible BOOLEAN,
    is_approved BOOLEAN DEFAULT NULL, -- NULL = pending, true = approved, false = rejected
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_permission_change_requests_status ON permission_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_permission_change_requests_requested_by ON permission_change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_permission_change_requests_reviewer ON permission_change_requests(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_permission_change_details_request_id ON permission_change_details(request_id);

-- ============================================================================
-- 4. CREATE UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_permission_change_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_permission_change_requests_timestamp ON permission_change_requests;
CREATE TRIGGER update_permission_change_requests_timestamp
    BEFORE UPDATE ON permission_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_permission_change_requests_timestamp();

-- ============================================================================
-- 5. ADD PERMISSION FOR VIEWING/MANAGING APPROVAL QUEUE
-- ============================================================================
INSERT INTO permissions (code, name, category, page, sort_order)
VALUES 
    ('menu:approval-queue', 'Approval Queue Menu', 'settings', 'settings-permissions', 1401),
    ('tab:approval-queue', 'Approval Queue Tab', 'settings', 'settings-permissions', 1402),
    ('btn:approval:approve', 'Approve Permission Changes', 'settings', 'settings-permissions', 1403),
    ('btn:approval:reject', 'Reject Permission Changes', 'settings', 'settings-permissions', 1404),
    ('btn:approval:approve-all', 'Approve All Permission Changes', 'settings', 'settings-permissions', 1405),
    ('btn:approval:reject-all', 'Reject All Permission Changes', 'settings', 'settings-permissions', 1406)
ON CONFLICT (code) DO NOTHING;

-- Grant these permissions to super_admin role (they manage approvals)
INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
SELECT r.id, p.code, true, true
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
AND p.code IN (
    'menu:approval-queue', 
    'tab:approval-queue', 
    'btn:approval:approve', 
    'btn:approval:reject',
    'btn:approval:approve-all',
    'btn:approval:reject-all'
)
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- ============================================================================
-- 6. VIEW FOR PENDING APPROVAL COUNT
-- ============================================================================
CREATE OR REPLACE VIEW pending_approval_count AS
SELECT COUNT(*) as count
FROM permission_change_requests
WHERE status = 'pending';

COMMIT;
