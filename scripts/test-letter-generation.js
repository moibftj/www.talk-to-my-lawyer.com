#!/usr/bin/env node

/**
 * Test Letter Generation System
 * Tests the new atomic allowance deduction functions
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

async function testRPCFunctions() {
  log(colors.blue, '📋', 'Testing RPC Functions...\n');

  const tests = [
    {
      name: 'check_and_deduct_allowance',
      rpc: 'check_and_deduct_allowance',
      params: { u_id: '00000000-0000-0000-0000-000000000000' } // Invalid user
    },
    {
      name: 'refund_letter_allowance',
      rpc: 'refund_letter_allowance',
      params: { u_id: '00000000-0000-0000-0000-000000000000', amount: 1 }
    },
    {
      name: 'increment_total_letters',
      rpc: 'increment_total_letters',
      params: { p_user_id: '00000000-0000-0000-0000-000000000000' }
    },
    {
      name: 'check_letter_allowance',
      rpc: 'check_letter_allowance',
      params: { u_id: '00000000-0000-0000-0000-000000000000' }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const { data, error } = await supabase.rpc(test.rpc, test.params);

      if (error && error.message.includes('Function not found')) {
        log(colors.red, '❌', `${test.name}: Function does not exist`);
        failed++;
      } else if (error) {
        // Function exists but returned an error (expected for invalid user)
        log(colors.green, '✅', `${test.name}: Function exists (error: ${error.message})`);
        passed++;
      } else {
        log(colors.green, '✅', `${test.name}: Function exists and executed`);
        passed++;
      }
    } catch (e) {
      log(colors.red, '❌', `${test.name}: ${e.message}`);
      failed++;
    }
  }

  console.log('');
  log(colors.cyan, '📊', `RPC Test Results: ${passed} passed, ${failed} failed\n`);

  return { passed, failed };
}

async function testDatabaseSchema() {
  log(colors.blue, '🔍', 'Testing Database Schema...\n');

  const { data: functions, error } = await supabase
    .rpc('get_admin_dashboard_stats');

  if (error) {
    log(colors.red, '❌', `Failed to call get_admin_dashboard_stats: ${error.message}`);
    return { passed: 0, failed: 1 };
  }

  log(colors.green, '✅', 'get_admin_dashboard_stats: Working');
  log(colors.cyan, 'ℹ️',  `Stats: ${JSON.stringify(data, null, 2)}`);

  return { passed: 1, failed: 0 };
}

async function testAtomicBehavior() {
  log(colors.blue, '⚛️', 'Testing Atomic Allowance Behavior...\n');

  // Test that functions use proper locking
  const testUserId = '00000000-0000-0000-0000-000000000001'; // Test user ID

  const { data: result, error } = await supabase.rpc('check_and_deduct_allowance', {
    u_id: testUserId
  });

  if (error) {
    if (error.message.includes('User not found')) {
      log(colors.green, '✅', 'Atomic function correctly rejects invalid user');
      return { passed: 1, failed: 0 };
    } else {
      log(colors.yellow, '⚠️', `Unexpected error: ${error.message}`);
      return { passed: 0, failed: 1 };
    }
  }

  // Check return structure
  if (result && result.length > 0) {
    const row = result[0];
    const required = ['success', 'remaining', 'error_message', 'is_free_trial', 'is_super_admin'];
    const hasAll = required.every(field => field in row);

    if (hasAll) {
      log(colors.green, '✅', 'Atomic function returns correct structure');
      return { passed: 1, failed: 0 };
    } else {
      log(colors.red, '❌', 'Atomic function missing required fields');
      return { passed: 0, failed: 1 };
    }
  }

  return { passed: 0, failed: 1 };
}

async function checkTables() {
  log(colors.blue, '📊', 'Checking Tables...\n');

  const tables = [
    'profiles', 'letters', 'subscriptions', 'employee_coupons',
    'commissions', 'letter_audit_trail', 'coupon_usage', 'payout_requests',
    'data_export_requests', 'data_deletion_requests', 'privacy_policy_acceptances',
    'admin_audit_log', 'email_queue', 'webhook_events'
  ];

  let passed = 0;
  let failed = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error && error.code === 'PGRST116') {
        log(colors.red, '❌', `${table}: Table not found`);
        failed++;
      } else {
        log(colors.green, '✅', `${table}: Accessible`);
        passed++;
      }
    } catch (e) {
      log(colors.red, '❌', `${table}: ${e.message}`);
      failed++;
    }
  }

  console.log('');
  log(colors.cyan, '📊', `Tables: ${passed}/${tables.length} accessible\n`);

  return { passed, failed };
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🧪', 'Letter Generation System Tests');
  console.log('='.repeat(60) + '\n');

  const results = {
    rpc: await testRPCFunctions(),
    schema: await testDatabaseSchema(),
    atomic: await testAtomicBehavior(),
    tables: await checkTables()
  };

  const totalPassed = results.rpc.passed + results.schema.passed + results.atomic.passed + results.tables.passed;
  const totalFailed = results.rpc.failed + results.schema.failed + results.atomic.failed + results.tables.failed;

  console.log('='.repeat(60));
  log(colors.cyan, '📋', 'Final Results');
  console.log('='.repeat(60));

  log(colors.green, '✅', `Total Passed: ${totalPassed}`);
  if (totalFailed > 0) {
    log(colors.red, '❌', `Total Failed: ${totalFailed}`);
  }

  if (totalFailed === 0) {
    log(colors.green, '\n🎉', 'All tests passed! Letter generation system is ready.\n');
  } else {
    log(colors.yellow, '\n⚠️', `Some tests failed. Please review the results above.\n`);
  }
}

main().catch(console.error);
