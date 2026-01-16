import { Resend } from 'resend'
import type { EmailMessage, EmailResult, EmailProviderInterface } from '../types'
import { emailConfig } from '@/lib/config'

export class ResendProvider implements EmailProviderInterface {
  name = 'resend' as const
  private client: Resend | undefined
  private fromEmail: string
  private fromName: string

  constructor() {
    const apiKey = emailConfig.apiKey
    if (apiKey) {
      this.client = new Resend(apiKey)
    }
    this.fromEmail = emailConfig.from
    this.fromName = emailConfig.fromName
  }

  isConfigured(): boolean {
    return !!this.client
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Resend is not configured',
        provider: this.name,
      }
    }

    const from = message.from
      ? `${message.from.name || this.fromName} <${message.from.email || this.fromEmail}>`
      : `${this.fromName} <${this.fromEmail}>`

    try {
      const result = await this.client.emails.send({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html || '',
        text: message.text,
        attachments: message.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      })

      // Check for API errors
      if (result.error) {
        console.error('[EmailService] Resend API error:', result.error)
        return {
          success: false,
          error: result.error.message || 'Resend API error',
          provider: this.name,
        }
      }

      // Check if data is actually present
      if (!result.data) {
        console.error('[EmailService] Resend returned no data:', result)
        return {
          success: false,
          error: 'No data returned from Resend API',
          provider: this.name,
        }
      }

      return {
        success: true,
        messageId: result.data.id,
        provider: this.name,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[EmailService] Resend error:', errorMessage)
      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      }
    }
  }
}