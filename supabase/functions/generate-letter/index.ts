// Supabase Edge Function for generating legal letters with OpenAI GPT-4 Turbo
// This function handles AI-powered letter generation with proper rate limiting and auditing

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Letter types and their descriptions for prompt engineering
const LETTER_TYPES: Record<
  string,
  { name: string; description: string; tone: string }
> = {
  "demand": {
    name: "Demand Letter",
    description: "A formal letter demanding specific action or compensation",
    tone: "firm, professional, and legally assertive",
  },
  "cease-desist": {
    name: "Cease and Desist Letter",
    description: "A letter demanding someone stop a specific activity",
    tone: "serious, authoritative, and legally grounded",
  },
  "complaint": {
    name: "Complaint Letter",
    description:
      "A formal letter expressing dissatisfaction and seeking resolution",
    tone: "professional, factual, and solution-oriented",
  },
  "dispute": {
    name: "Dispute Letter",
    description:
      "A letter challenging or disputing a claim, charge, or decision",
    tone: "logical, evidence-based, and professionally assertive",
  },
  "notice": {
    name: "Legal Notice",
    description: "A formal notice informing of legal rights or intentions",
    tone: "formal, clear, and legally precise",
  },
  "response": {
    name: "Response Letter",
    description: "A formal response to a legal inquiry or demand",
    tone: "measured, professional, and legally sound",
  },
  "settlement": {
    name: "Settlement Proposal",
    description: "A letter proposing settlement terms for a dispute",
    tone: "diplomatic, professional, and constructive",
  },
  "termination": {
    name: "Termination Notice",
    description: "A formal notice of contract or agreement termination",
    tone: "formal, direct, and legally compliant",
  },
};

interface LetterGenerationRequest {
  letterType: string;
  recipientName: string;
  recipientAddress?: string;
  subject: string;
  situation: string;
  desiredOutcome: string;
  additionalContext?: string;
  senderName: string;
  senderAddress?: string;
  deadline?: string;
  previousCorrespondence?: string;
}

interface LetterGenerationResult {
  success: boolean;
  content?: string;
  letterType?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function buildSystemPrompt(letterType: typeof LETTER_TYPES[string]): string {
  return `You are an expert legal letter writer. Your task is to draft professional, legally sound ${letterType.name}s.

IMPORTANT GUIDELINES:
1. Use a ${letterType.tone} tone throughout the letter
2. Structure the letter with proper legal formatting:
   - Date
   - Recipient information
   - Subject line with "RE:" prefix
   - Professional salutation
   - Clear introduction stating purpose
   - Body with facts and legal basis
   - Specific demands or requests
   - Deadline for response (if applicable)
   - Professional closing
   - Sender information

3. Include relevant legal language but keep it accessible
4. Be specific about facts and dates mentioned by the user
5. Include a clear call to action
6. Do NOT include specific legal citations unless provided by the user
7. Add a disclaimer that this letter was prepared with AI assistance and should be reviewed by an attorney
8. Format the output as plain text, suitable for professional correspondence

LETTER TYPE: ${letterType.name}
PURPOSE: ${letterType.description}`;
}

function buildUserPrompt(request: LetterGenerationRequest): string {
  let prompt =
    `Please draft a professional legal letter with the following details:

RECIPIENT:
- Name: ${request.recipientName}
${request.recipientAddress ? `- Address: ${request.recipientAddress}` : ""}

SENDER:
- Name: ${request.senderName}
${request.senderAddress ? `- Address: ${request.senderAddress}` : ""}

SUBJECT: ${request.subject}

SITUATION/BACKGROUND:
${request.situation}

DESIRED OUTCOME:
${request.desiredOutcome}`;

  if (request.deadline) {
    prompt += `\n\nRESPONSE DEADLINE: ${request.deadline}`;
  }

  if (request.previousCorrespondence) {
    prompt += `\n\nPREVIOUS CORRESPONDENCE/CONTEXT:
${request.previousCorrespondence}`;
  }

  if (request.additionalContext) {
    prompt += `\n\nADDITIONAL CONTEXT:
${request.additionalContext}`;
  }

  prompt +=
    `\n\nPlease generate a complete, professional letter ready for review and sending.`;

  return prompt;
}

async function generateLetter(
  request: LetterGenerationRequest,
): Promise<LetterGenerationResult> {
  if (!OPENAI_API_KEY) {
    console.error("[GenerateLetter] OPENAI_API_KEY not configured");
    return { success: false, error: "AI service not configured" };
  }

  const letterTypeConfig = LETTER_TYPES[request.letterType];
  if (!letterTypeConfig) {
    return {
      success: false,
      error: `Invalid letter type: ${request.letterType}`,
    };
  }

  const systemPrompt = buildSystemPrompt(letterTypeConfig);
  const userPrompt = buildUserPrompt(request);

  console.log("[GenerateLetter] Generating letter:", {
    letterType: request.letterType,
    recipient: request.recipientName,
    subject: request.subject,
  });

  try {
    const startTime = Date.now();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[GenerateLetter] OpenAI API error:", data);
      return {
        success: false,
        error: data.error?.message || "Failed to generate letter",
      };
    }

    const generatedContent = data.choices?.[0]?.message?.content;
    if (!generatedContent) {
      return { success: false, error: "No content generated" };
    }

    const duration = Date.now() - startTime;
    console.log(
      "[GenerateLetter] Letter generated successfully in",
      duration,
      "ms",
    );

    return {
      success: true,
      content: generatedContent,
      letterType: letterTypeConfig.name,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    console.error("[GenerateLetter] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get user profile to check subscription and credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check subscription status and remaining credits
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("id, status, remaining_letters, credits_remaining")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({
          error: "Active subscription required",
          code: "NO_SUBSCRIPTION",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const remainingCredits = subscription.remaining_letters ||
      subscription.credits_remaining || 0;
    if (remainingCredits <= 0) {
      return new Response(
        JSON.stringify({
          error: "No letter credits remaining",
          code: "NO_CREDITS",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const letterRequest: LetterGenerationRequest = await req.json();

    // Validate required fields
    if (
      !letterRequest.letterType || !letterRequest.recipientName ||
      !letterRequest.subject || !letterRequest.situation ||
      !letterRequest.desiredOutcome || !letterRequest.senderName
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          required: [
            "letterType",
            "recipientName",
            "subject",
            "situation",
            "desiredOutcome",
            "senderName",
          ],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate the letter
    const result = await generateLetter(letterRequest);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create letter record in database
    const { data: letter, error: letterError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        letter_type: letterRequest.letterType,
        title: letterRequest.subject,
        content: result.content,
        recipient_name: letterRequest.recipientName,
        recipient_address: letterRequest.recipientAddress || null,
        status: "draft",
        metadata: {
          situation: letterRequest.situation,
          desiredOutcome: letterRequest.desiredOutcome,
          additionalContext: letterRequest.additionalContext,
          deadline: letterRequest.deadline,
          aiUsage: result.usage,
          generatedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (letterError) {
      console.error("[GenerateLetter] Failed to save letter:", letterError);
      // Return the content anyway since generation was successful
      return new Response(
        JSON.stringify({
          success: true,
          content: result.content,
          letterType: result.letterType,
          warning: "Letter generated but failed to save to database",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Deduct credit from subscription
    await supabase
      .from("subscriptions")
      .update({
        remaining_letters: remainingCredits - 1,
        credits_remaining: remainingCredits - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    // Log audit trail
    await supabase.from("letter_audit_trail").insert({
      letter_id: letter.id,
      action: "generated",
      actor_id: user.id,
      details: {
        letterType: letterRequest.letterType,
        aiModel: "gpt-4-turbo",
        tokensUsed: result.usage?.totalTokens,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        letterId: letter.id,
        content: result.content,
        letterType: result.letterType,
        creditsRemaining: remainingCredits - 1,
        usage: result.usage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[GenerateLetter] Handler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
