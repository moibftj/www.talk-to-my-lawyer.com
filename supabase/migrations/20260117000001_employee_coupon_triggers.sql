-- Migration: Employee Coupon Auto-Creation Triggers
-- This migration creates the database triggers and functions needed for
-- automatic employee coupon creation when an employee profile is created.
-- 
-- The employee coupon system:
-- 1. Automatically creates a unique 20% discount coupon when an employee signs up
-- 2. Handles role changes (subscriber -> employee) to create coupons
-- 3. Prevents duplicate coupons per employee
-- 4. Supports 5% commission tracking when subscribers use employee coupons

-- Step 1: Ensure employee_coupons table exists with proper structure
CREATE TABLE IF NOT EXISTS employee_coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 20 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Ensure commissions table exists
CREATE TABLE IF NOT EXISTS commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  subscription_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  commission_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Ensure coupon_usage table exists
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coupon_code VARCHAR(50) NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  discount_percent INTEGER,
  amount_before DECIMAL(10,2),
  amount_after DECIMAL(10,2),
  ip_address VARCHAR(45),
  user_agent TEXT,
  fraud_risk_score INTEGER DEFAULT 0,
  fraud_detection_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_coupons_employee_id ON employee_coupons(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_coupons_code ON employee_coupons(code);
CREATE INDEX IF NOT EXISTS idx_commissions_employee_id ON commissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_code ON coupon_usage(coupon_code);

-- Step 5: Create the auto-coupon trigger function
CREATE OR REPLACE FUNCTION create_employee_coupon()
RETURNS TRIGGER AS $$
DECLARE
  coupon_code TEXT;
  attempts INT := 0;
  max_attempts INT := 5;
BEGIN
  -- Only create coupon for employee role
  IF NEW.role = 'employee' THEN
    -- Check if coupon already exists for this employee
    IF EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Generate unique coupon code with retry logic
    LOOP
      coupon_code := 'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT || attempts::TEXT), 1, 6));
      
      BEGIN
        INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (NEW.id, coupon_code, 20, true);
        
        RAISE NOTICE 'Created employee coupon % for employee %', coupon_code, NEW.id;
        EXIT;
      EXCEPTION 
        WHEN unique_violation THEN
          attempts := attempts + 1;
          IF attempts >= max_attempts THEN
            RAISE WARNING 'Failed to create unique coupon after % attempts for employee %', max_attempts, NEW.id;
            EXIT;
          END IF;
        WHEN OTHERS THEN
          RAISE WARNING 'Error creating employee coupon for %: %', NEW.id, SQLERRM;
          EXIT;
      END;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 6: Create trigger on INSERT
DROP TRIGGER IF EXISTS trigger_create_employee_coupon ON profiles;
CREATE TRIGGER trigger_create_employee_coupon
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_coupon();

-- Step 7: Handle role updates (subscriber -> employee)
CREATE OR REPLACE FUNCTION handle_employee_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if role changed TO employee
  IF NEW.role = 'employee' AND (OLD.role IS NULL OR OLD.role != 'employee') THEN
    -- Check if coupon already exists
    IF NOT EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
      VALUES (
        NEW.id,
        'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
        20,
        true
      )
      ON CONFLICT (employee_id) DO NOTHING;
      
      RAISE NOTICE 'Created employee coupon for role change to employee: %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 8: Create trigger on UPDATE
DROP TRIGGER IF EXISTS trigger_handle_employee_role_change ON profiles;
CREATE TRIGGER trigger_handle_employee_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_employee_role_change();

-- Step 9: Create function for free subscription with commission (atomic)
CREATE OR REPLACE FUNCTION create_free_subscription(
  p_user_id UUID,
  p_plan_type VARCHAR,
  p_monthly_allowance INTEGER,
  p_total_letters INTEGER,
  p_final_price DECIMAL,
  p_base_price DECIMAL,
  p_discount_amount DECIMAL,
  p_coupon_code VARCHAR DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_commission_rate DECIMAL DEFAULT 0.05
)
RETURNS TABLE (
  success BOOLEAN,
  subscription_id UUID,
  commission_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_subscription_id UUID;
  v_commission_id UUID;
  v_commission_amount DECIMAL;
BEGIN
  -- Create the subscription
  INSERT INTO subscriptions (
    user_id,
    plan,
    plan_type,
    status,
    price,
    discount,
    coupon_code,
    remaining_letters,
    credits_remaining,
    monthly_allowance,
    last_reset_at,
    current_period_start,
    current_period_end
  ) VALUES (
    p_user_id,
    p_plan_type,
    p_plan_type,
    'active',
    p_final_price,
    p_discount_amount,
    p_coupon_code,
    p_total_letters,
    p_total_letters,
    p_monthly_allowance,
    NOW(),
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_subscription_id;

  -- Create commission if there's an employee referral
  IF p_employee_id IS NOT NULL AND p_final_price > 0 THEN
    v_commission_amount := p_final_price * p_commission_rate;
    
    INSERT INTO commissions (
      employee_id,
      subscription_id,
      subscription_amount,
      commission_rate,
      commission_amount,
      status
    ) VALUES (
      p_employee_id,
      v_subscription_id,
      p_final_price,
      p_commission_rate,
      v_commission_amount,
      'pending'
    )
    RETURNING id INTO v_commission_id;

    -- Update coupon usage count
    UPDATE employee_coupons
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE employee_id = p_employee_id;
  END IF;

  -- Record coupon usage
  IF p_coupon_code IS NOT NULL THEN
    INSERT INTO coupon_usage (
      user_id,
      coupon_code,
      employee_id,
      subscription_id,
      discount_percent,
      amount_before,
      amount_after
    ) VALUES (
      p_user_id,
      p_coupon_code,
      p_employee_id,
      v_subscription_id,
      CASE WHEN p_base_price > 0 THEN (p_discount_amount / p_base_price * 100)::INTEGER ELSE 0 END,
      p_base_price,
      p_final_price
    );
  END IF;

  RETURN QUERY SELECT true, v_subscription_id, v_commission_id, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Backfill coupons for existing employees who don't have one
INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
SELECT 
  p.id,
  'EMP-' || UPPER(SUBSTR(MD5(p.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
  20,
  true
FROM profiles p
WHERE p.role = 'employee'
  AND NOT EXISTS (
    SELECT 1 FROM employee_coupons ec WHERE ec.employee_id = p.id
  )
ON CONFLICT (employee_id) DO NOTHING;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_employee_coupon() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_employee_role_change() TO authenticated;
GRANT EXECUTE ON FUNCTION create_free_subscription(UUID, VARCHAR, INTEGER, INTEGER, DECIMAL, DECIMAL, DECIMAL, VARCHAR, UUID, DECIMAL) TO authenticated;
