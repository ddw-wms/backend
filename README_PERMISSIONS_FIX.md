Summary of permission fixes and deployment steps

What I changed

- Fixed backend authorization middleware (`hasPermission`) to:
  - **Bypass** permission checks for `admin` role (admin always has access).
  - **Check user-specific overrides** first (`user_permissions`) and use them to grant/deny access before falling back to `role_permissions`.
- Added missing database migration `migrations/add_delete_picking_permission.sql` to insert `delete_picking` permission and grant it to `admin` and `manager` by default.
- Regenerated `wms_frontend/permission_manifest.json` (so the Permissions UI includes `delete_picking` and other function-level permissions).
- Updated backend unit tests to reflect the new middleware behavior and added a test for `admin` bypass.

Why this fixes the "Admin forbidden" issue

- Previously `hasPermission` only checked `role_permissions`. If a permission key was missing from the `permissions` table or not assigned to the role, even `admin` could get a 403. The middleware now explicitly allows `admin` users and honors per-user overrides.

How to apply these changes locally / on the server

1. Pull the changes into your repository.

2. Run SQL migration to add the new permission (requires DB access):

   Using psql (example):
   psql "${DATABASE_URL}" -f "migrations/add_delete_picking_permission.sql"

   Or connect via your DB client and execute the file contents.

3. (Optional) Re-run the main migration if setting up a fresh DB (the main migration file `migrations/create_permissions_system.sql` already seeds most permissions).

   node run-permissions-migration.js

4. Regenerate the frontend permission manifest (this is done automatically by the repo script if you want to update the manifest):

   node scripts/generate_permission_manifest.js

   This updates `wms_frontend/permission_manifest.json` and drives the Permissions UI's list of available toggles.

5. Restart backend and frontend servers. For local dev:

   - Backend: from `wms_backend` folder
     npm run dev

   - Frontend: from `wms_frontend` folder
     npm run dev

6. Verify manually:

   - Login as `admin` and try deleting a picking batch — it should work (no 403) and show a success toast.
   - Visit `Settings → Permissions` and confirm `delete_picking` appears and can be toggled for roles and users.

Notes & next steps

- If you want to allow or deny the new permission for other roles by default (e.g., `manager`), update the `migrations/add_delete_picking_permission.sql` file appropriately or apply `INSERT`/`UPDATE` statements in your DB.
- If you prefer `admin` not to bypass checks (strict policy), revert the admin bypass in `src/middleware/auth.middleware.ts` and ensure `role_permissions` contains admin assignments.

If you want, I can:
- Add a migration runner that applies all `migrations/*.sql` files in order (instead of running individual SQL files).
- Add a small end-to-end test to assert that admin can delete picking batches via the API.

