import type {
  EmailMessage,
  EmailResult,
  EmailProviderInterface,
  EmailTemplate,
  TemplateData,
} from './types'
import { ResendProvider } from './providers/resend'
import { renderTemplate } from './templates'
import { emailConfig } from '@/lib/config'

class EmailService {
  private provider: EmailProviderInterface
  private fromEmail: string
  private fromName: string

  constructor() {
    // Resend is the only email provider
    this.provider = new ResendProvider()

    this.fromEmail = emailConfig.from
    this.fromName = emailConfig.fromName

    // Verify Resend is configured
    if (!this.provider.isConfigured()) {
      console.error('[EmailService] Resend is not configured! Set RESEND_API_KEY environment variable.')
    }
  }

  isConfigured(): boolean {
    return this.provider.isConfigured()
  }

  getDefaultFrom(): { email: string; name: string } {
    return {
      email: this.fromEmail,
      name: this.fromName,
    }
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const messageWithDefaults: EmailMessage = {
      ...message,
      from: message.from || this.getDefaultFrom(),
    }

    try {
      const result = await this.provider.send(messageWithDefaults)

      if (result.success) {
        console.log(`[EmailService] Email sent successfully via ${result.provider}:`, {
          to: message.to,
          subject: message.subject,
          messageId: result.messageId,
        })
      } else {
        console.error(`[EmailService] Failed to send email via ${result.provider}:`, result.error)
      }

      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[EmailService] Unexpected error:', errorMessage)

      return {
        success: false,
        error: errorMessage,
        provider: this.provider.name,
      }
    }
  }

  async sendTemplate(
    template: EmailTemplate,
    to: string | string[],
    data: TemplateData
  ): Promise<EmailResult> {
    const { subject, text, html } = renderTemplate(template, data)

    return this.send({
      to,
      subject,
      text,
      html,
    })
  }

  async sendWithRetry(
    message: EmailMessage,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<EmailResult> {
    let lastResult: EmailResult | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.send(message)

      if (result.success) {
        return result
      }

      lastResult = result
      console.warn(`[EmailService] Attempt ${attempt}/${maxRetries} failed:`, result.error)

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }

    return lastResult || {
      success: false,
      error: 'Max retries exceeded',
      provider: this.provider.name,
    }
  }
}

let emailServiceInstance: EmailService | null = null

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService()
  }
  return emailServiceInstance
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  return getEmailService().send(message)
}

export async function sendTemplateEmail(
  template: EmailTemplate,
  to: string | string[],
  data: TemplateData
): Promise<EmailResult> {
  return getEmailService().sendTemplate(template, to, data)
}

/**
 * Queue a template email for reliable delivery with automatic retries
 * NOW SENDS IMMEDIATELY - falls back to queue only on failure
 * This provides:
 * - Immediate delivery for most emails
 * - Automatic retries on failure via queue
 * - Persistence in case of server issues
 *
 * @param template - The email template to use
 * @param to - Recipient email address(es)
 * @param data - Template data
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<string> - Message ID or queue item ID
 */
export async function queueTemplateEmail(
  template: EmailTemplate,
  to: string | string[],
  data: TemplateData,
  maxRetries: number = 3
): Promise<string> {
  const { renderTemplate } = await import('./templates')

  const { subject, text, html } = renderTemplate(template, data)
  
  // Try to send immediately first
  const emailService = getEmailService()
  
  if (emailService.isConfigured()) {
    try {
      const result = await emailService.send({
        to,
        subject,
        text,
        html,
      })
      
      if (result.success) {
        console.log('[Email] Sent immediately:', { to, subject, messageId: result.messageId })
        return result.messageId || 'sent'
      }
      
      console.warn('[Email] Immediate send failed, falling back to queue:', result.error)
    } catch (error) {
      console.warn('[Email] Immediate send error, falling back to queue:', error)
    }
  }
  
  // Fall back to queue for retry
  const { getEmailQueue } = await import('./queue')
  const queue = getEmailQueue()

  return queue.enqueue({
    to,
    subject,
    text,
    html,
  }, maxRetries)
}

export { EmailService }
