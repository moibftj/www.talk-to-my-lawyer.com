/*
  P0-2: Fix Race Condition in Coupon Usage Tracking

  This migration adds an atomic function to increment coupon usage count
  using a single database UPDATE with RETURNING clause.

  Problem: The previous implementation had a race condition where:
  1. Read current usage_count from employee_coupons
  2. Calculate new value (usage_count + 1)
  3. Update usage_count

  Between steps 1 and 3, concurrent requests could read the same value
  and all write the same incremented value, resulting in lost usage counts.

  Solution: Use a single atomic UPDATE statement that increments at the
  database level using PostgreSQL's atomic operations.
*/

-- Create atomic increment function by coupon code
CREATE OR REPLACE FUNCTION public.increment_coupon_usage_by_code(
    coupon_code TEXT
)
RETURNS TABLE(
    success BOOLEAN,
    usage_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_usage_count INTEGER;
    v_coupon_id UUID;
BEGIN
    -- Lock the coupon row and increment usage count atomically
    UPDATE public.employee_coupons
    SET usage_count = employee_coupons.usage_count + 1,
        updated_at = NOW()
    WHERE code = UPPER(coupon_code)
      AND is_active = true
    RETURNING id, usage_count INTO v_coupon_id, v_usage_count;

    -- Check if the coupon was found and updated
    IF v_coupon_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'Coupon not found or inactive'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_usage_count::INTEGER, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create atomic increment function by coupon ID
CREATE OR REPLACE FUNCTION public.increment_coupon_usage_by_id(
    coupon_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    usage_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_usage_count INTEGER;
BEGIN
    -- Lock the coupon row and increment usage count atomically
    UPDATE public.employee_coupons
    SET usage_count = employee_coupons.usage_count + 1,
        updated_at = NOW()
    WHERE id = coupon_id
      AND is_active = true
    RETURNING usage_count INTO v_usage_count;

    -- Check if the coupon was found and updated
    IF v_usage_count IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'Coupon not found or inactive'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_usage_count::INTEGER, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage_by_code(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage_by_id(UUID) TO authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.increment_coupon_usage_by_code IS 'Atomically increments coupon usage count by code. Uses database-level UPDATE to prevent race conditions in concurrent checkout scenarios.';
COMMENT ON FUNCTION public.increment_coupon_usage_by_id IS 'Atomically increments coupon usage count by ID. Uses database-level UPDATE to prevent race conditions in concurrent checkout scenarios.';
