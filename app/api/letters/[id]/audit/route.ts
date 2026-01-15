import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify user is admin or employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'employee'].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin or employee access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // For employees: verify they have a relationship to this letter
    // (i.e., the letter was created by a user who used their referral coupon)
    if (profile.role === 'employee') {
      // Get the letter to find its owner
      const { data: letter } = await supabase
        .from('letters')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!letter) {
        return NextResponse.json(
          { error: "Letter not found" },
          { status: 404 }
        );
      }

      // Check if this employee has any relationship to the letter owner
      // (via subscription that used their coupon)
      const { data: relationship } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', letter.user_id)
        .eq('employee_id', user.id)
        .limit(1)
        .single();

      if (!relationship) {
        return NextResponse.json(
          { error: "You do not have permission to view this letter's audit trail" },
          { status: 403 }
        );
      }
    }

    // Get audit trail for the letter
    const { data: auditTrail, error } = await supabase
      .from('letter_audit_trail')
      .select(`
        *,
        performer:performed_by (
          id,
          email,
          full_name
        )
      `)
      .eq('letter_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AuditTrail] Query error:', error);
      return NextResponse.json(
        { error: "Failed to fetch audit trail" },
        { status: 500 }
      );
    }

    return NextResponse.json({ auditTrail });

  } catch (error) {
    console.error('[AuditTrail] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
