-- =============================================
-- MIGRATION: Fix Delete Policy for Manufacturers
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable DELETE policy for manufacturers so they can remove their own products
CREATE POLICY "Manufacturers can delete own products" ON products
FOR DELETE USING (manufacturer_id = auth.uid());

-- Note: Ensure that if you delete a parent product, you also delete its variations.
-- The client-side code handles this by deleting variations first, but you can also
-- add ON DELETE CASCADE to the parent_id foreign key in the database for safety:
-- ALTER TABLE products DROP CONSTRAINT products_parent_id_fkey;
-- ALTER TABLE products ADD CONSTRAINT products_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES products(id) ON DELETE CASCADE;
