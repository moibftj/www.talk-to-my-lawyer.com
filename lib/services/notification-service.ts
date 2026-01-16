/**
 * Notification Service
 *
 * Centralizes all email notification logic for the application
 */

import { queueTemplateEmail } from '@/lib/email/service'
import { getAdminEmails } from '@/lib/admin/letter-actions'
import { getAppUrl } from '@/lib/config'

/**
 * Notify admins about a new letter pending review
 *
 * @param letterId - ID of the letter
 * @param letterTitle - Title of the letter
 * @param letterType - Type of letter
 */
export async function notifyAdminsNewLetter(
  letterId: string,
  letterTitle: string,
  letterType: string
): Promise<void> {
  const adminEmails = await getAdminEmails()

  if (adminEmails.length === 0) {
    console.warn('[NotificationService] No admin emails configured')
    return
  }

  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('admin-alert', adminEmails, {
      alertMessage: `New letter "${letterTitle}" requires review. Letter type: ${letterType}`,
      actionUrl: `${siteUrl}/secure-admin-gateway/review/${letterId}`,
      pendingReviews: 1,
    })
    console.log('[NotificationService] Admin notification queued for letter:', letterId)
  } catch (error) {
    console.error('[NotificationService] Failed to queue admin notification:', error)
  }
}

/**
 * Notify user about letter approval
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the approved letter
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterApproved(
  userEmail: string,
  userName: string,
  letterTitle: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-approved', userEmail, {
      userName,
      letterTitle,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Approval notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue approval notification:', error)
  }
}

/**
 * Notify user about letter rejection
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the rejected letter
 * @param rejectionReason - Reason for rejection
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterRejected(
  userEmail: string,
  userName: string,
  letterTitle: string,
  rejectionReason: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-rejected', userEmail, {
      userName,
      letterTitle,
      rejectionReason,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Rejection notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue rejection notification:', error)
  }
}

/**
 * Notify user when letter is ready for download
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the letter
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterReady(
  userEmail: string,
  userName: string,
  letterTitle: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-ready', userEmail, {
      userName,
      letterTitle,
      downloadLink: `${siteUrl}/dashboard/letters/${letterId}/pdf`,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Ready notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue ready notification:', error)
  }
}

/**
 * Send welcome email to new user
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 */
export async function notifyUserWelcome(
  userEmail: string,
  userName: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('welcome', userEmail, {
      userName,
      dashboardLink: `${siteUrl}/dashboard`,
    })
    console.log('[NotificationService] Welcome email queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue welcome email:', error)
  }
}

/**
 * Notify user about subscription changes
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param subscriptionDetails - Details about the subscription
 */
export async function notifyUserSubscriptionUpdate(
  userEmail: string,
  userName: string,
  subscriptionDetails: {
    planName: string
    status: string
    creditsRemaining?: number
  }
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('subscription-update', userEmail, {
      userName,
      planName: subscriptionDetails.planName,
      status: subscriptionDetails.status,
      creditsRemaining: subscriptionDetails.creditsRemaining,
      dashboardLink: `${siteUrl}/dashboard`,
    })
    console.log('[NotificationService] Subscription update queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue subscription update:', error)
  }
}
