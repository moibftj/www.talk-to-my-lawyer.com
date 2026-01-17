/**
 * Supabase Edge Functions Client
 *
 * Helper functions to call Supabase Edge Functions for:
 * - Email sending (send-email)
 * - Letter generation (generate-letter)
 */

import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface EmailRequest {
    to: string | string[];
    subject?: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    template?: string;
    templateData?: Record<string, unknown>;
}

interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

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
    letterId?: string;
    content?: string;
    letterType?: string;
    creditsRemaining?: number;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Send email via Supabase Edge Function
 * Uses Resend API under the hood
 */
export async function sendEmailViaEdge(
    request: EmailRequest,
): Promise<EmailResult> {
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            return { success: false, error: "Not authenticated" };
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/send-email`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(request),
            },
        );

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.error || "Failed to send email",
            };
        }

        return result;
    } catch (error) {
        console.error("[EdgeFunctions] sendEmail error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Send templated email via Edge Function
 * Predefined templates: welcome, letter-approved, letter-rejected, payment-success, commission-earned
 */
export async function sendTemplatedEmail(
    template: string,
    to: string,
    data: Record<string, unknown>,
): Promise<EmailResult> {
    return sendEmailViaEdge({
        to,
        template,
        templateData: data,
    });
}

/**
 * Generate legal letter via Supabase Edge Function
 * Uses OpenAI GPT-4 Turbo under the hood
 */
export async function generateLetterViaEdge(
    request: LetterGenerationRequest,
): Promise<LetterGenerationResult> {
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            return { success: false, error: "Not authenticated" };
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/generate-letter`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(request),
            },
        );

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.error || "Failed to generate letter",
            };
        }

        return result;
    } catch (error) {
        console.error("[EdgeFunctions] generateLetter error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Letter types available for generation
 */
export const LETTER_TYPES = {
    "demand": "Demand Letter",
    "cease-desist": "Cease and Desist Letter",
    "complaint": "Complaint Letter",
    "dispute": "Dispute Letter",
    "notice": "Legal Notice",
    "response": "Response Letter",
    "settlement": "Settlement Proposal",
    "termination": "Termination Notice",
} as const;

export type LetterType = keyof typeof LETTER_TYPES;
