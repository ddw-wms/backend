-- Fix QC table CASCADE delete issue
-- This script removes the CASCADE delete constraint from QC table
-- So that deleting inbound batches won't delete QC records

-- Step 1: Find the constraint name (if it exists)
-- You can check with: SELECT conname FROM pg_constraint WHERE conrelid = 'qc'::regclass AND confrelid = 'inbound'::regclass;

-- Step 2: Drop the existing foreign key constraint (if it exists)
-- Replace 'qc_inbound_id_fkey' with your actual constraint name
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'qc_inbound_id_fkey' AND conrelid = 'qc'::regclass
    ) THEN
        ALTER TABLE qc DROP CONSTRAINT qc_inbound_id_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint qc_inbound_id_fkey';
    ELSE
        RAISE NOTICE 'No constraint named qc_inbound_id_fkey found';
    END IF;
END $$;

-- Step 3: Add the foreign key constraint back WITHOUT CASCADE
-- This will set inbound_id to NULL when the inbound record is deleted
-- instead of deleting the QC record
ALTER TABLE qc 
ADD CONSTRAINT qc_inbound_id_fkey 
FOREIGN KEY (inbound_id) 
REFERENCES inbound(id) 
ON DELETE SET NULL;

-- Verify the change
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conname = 'qc_inbound_id_fkey';

SELECT 'QC foreign key constraint updated successfully - ON DELETE CASCADE removed' AS status;
