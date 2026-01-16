// supabase/functions/process-email-queue/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Your application URL - UPDATE THIS
const APP_URL = Deno.env.get("APP_URL") || "https://talk-to-my-lawyer.com";

// Your sender email - UPDATE THIS
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@talk-to-my-lawyer.com";
const FROM_NAME = Deno.env.get("FROM_NAME") || "Talk-To-My-Lawyer";

interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  html: string | null;
  text: string | null;
  attempts: number;
  max_retries: number;
  created_at: string;
}

serve(async (req) => {
  try {
    // Verify the request (optional: add API key check for security)
    const authHeader = req.headers.get("Authorization");

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending emails (default 10 at a time)
    const { data: emails, error: fetchError } = await supabase
      .rpc("get_pending_emails", { p_limit: 10 });

    if (fetchError) {
      console.error("Error fetching emails:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: "No pending emails", processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${emails.length} emails...`);

    let successCount = 0;
    let failCount = 0;

    // Process each email
    for (const email of emails as EmailRecord[]) {
      const startTime = Date.now();

      try {
        // Replace APP_URL placeholder in HTML content
        let htmlContent = email.html || "";
        htmlContent = htmlContent.replace(/\{\{APP_URL\}\}/g, APP_URL);

        // Send via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [email.to],
            subject: email.subject,
            html: htmlContent,
            text: email.text || undefined,
          }),
        });

        const responseTime = Date.now() - startTime;

        if (resendResponse.ok) {
          // Mark as sent
          await supabase.rpc("mark_email_sent", {
            p_email_id: email.id,
            p_provider: "resend",
            p_response_time_ms: responseTime,
          });
          successCount++;
          console.log(`✅ Sent email to ${email.to}: ${email.subject}`);
        } else {
          const errorData = await resendResponse.json();
          throw new Error(errorData.message || `Resend API error: ${resendResponse.status}`);
        }
      } catch (sendError: any) {
        // Mark as failed
        await supabase.rpc("mark_email_failed", {
          p_email_id: email.id,
          p_error_message: sendError.message || "Unknown error",
          p_provider: "resend",
        });
        failCount++;
        console.error(`❌ Failed to send email to ${email.to}:`, sendError.message);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Email processing complete",
        processed: emails.length,
        success: successCount,
        failed: failCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
