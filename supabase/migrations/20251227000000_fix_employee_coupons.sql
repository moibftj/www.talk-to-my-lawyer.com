-- Fix employee coupon auto-generation system
-- This migration:
-- 1. Adds unique constraint on employee_id (if not exists)
-- 2. Creates coupons for existing employees who don't have one
-- 3. Updates the trigger function to be more robust

-- Step 1: Add unique constraint on employee_id (allows only one coupon per employee)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_coupons_employee_id_key'
  ) THEN
    ALTER TABLE employee_coupons ADD CONSTRAINT employee_coupons_employee_id_key UNIQUE (employee_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

-- Step 2: Create coupons for existing employees who don't have one
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

-- Step 3: Update the trigger function with better error handling
CREATE OR REPLACE FUNCTION create_employee_coupon()
RETURNS TRIGGER AS $$
DECLARE
  coupon_code TEXT;
  attempts INT := 0;
  max_attempts INT := 5;
BEGIN
  -- Only create coupon for employee role
  IF NEW.role = 'employee' THEN
    -- First check if coupon already exists for this employee
    IF EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      -- Coupon already exists, don't create another
      RETURN NEW;
    END IF;

    -- Generate unique coupon code with retry logic
    LOOP
      -- Generate code: EMP-XXXXXX (6 random alphanumeric chars)
      coupon_code := 'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT || attempts::TEXT), 1, 6));
      
      BEGIN
        INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (
          NEW.id,
          coupon_code,
          20,
          true
        );
        -- Success, exit loop
        RAISE NOTICE 'Created employee coupon % for user %', coupon_code, NEW.id;
        EXIT;
      EXCEPTION 
        WHEN unique_violation THEN
          attempts := attempts + 1;
          IF attempts >= max_attempts THEN
            RAISE WARNING 'Failed to generate unique coupon code for employee % after % attempts', NEW.id, max_attempts;
            EXIT;
          END IF;
          -- Continue loop to try again with new code
        WHEN OTHERS THEN
          RAISE WARNING 'Unexpected error creating coupon for employee %: %', NEW.id, SQLERRM;
          EXIT;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_create_employee_coupon ON profiles;
CREATE TRIGGER trigger_create_employee_coupon
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_coupon();

-- Step 5: Also handle role updates (if someone's role changes to employee)
CREATE OR REPLACE FUNCTION handle_employee_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If role changed TO employee
  IF NEW.role = 'employee' AND (OLD.role IS NULL OR OLD.role != 'employee') THEN
    -- Check if coupon already exists
    IF NOT EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      -- Create coupon using the same logic as create_employee_coupon
      INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
      VALUES (
        NEW.id,
        'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
        20,
        true
      )
      ON CONFLICT (employee_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_handle_employee_role_change ON profiles;
CREATE TRIGGER trigger_handle_employee_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_employee_role_change();
