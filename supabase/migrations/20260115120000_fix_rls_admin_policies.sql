-- Fix RLS policies for admin access to specific tables
-- Identified in Verification Report as P0 Critical Issue

-- =====================================================
-- 1. Payout Requests
-- =====================================================
-- Allow admins to view all payout requests
DROP POLICY IF EXISTS "Admins can view all payout requests" ON payout_requests;
CREATE POLICY "Admins can view all payout requests"
  ON payout_requests FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Allow admins to update payout requests (e.g. marking processed)
DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;
CREATE POLICY "Admins can update payout requests"
  ON payout_requests FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));


-- =====================================================
-- 2. Privacy Policy Acceptances
-- =====================================================
-- Allow admins to view who accepted policies (for audit)
DROP POLICY IF EXISTS "Admins can view all privacy acceptances" ON privacy_policy_acceptances;
CREATE POLICY "Admins can view all privacy acceptances"
  ON privacy_policy_acceptances FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));


-- =====================================================
-- 3. Data Export Requests
-- =====================================================
-- Allow admins to view export requests
DROP POLICY IF EXISTS "Admins can view all export requests" ON data_export_requests;
CREATE POLICY "Admins can view all export requests"
  ON data_export_requests FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- Allow admins to update requests (e.g. marking failed/completed manual steps)
DROP POLICY IF EXISTS "Admins can update export requests" ON data_export_requests;
CREATE POLICY "Admins can update export requests"
  ON data_export_requests FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));
