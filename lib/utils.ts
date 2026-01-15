import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combine multiple class names into a single string
 * Handles Tailwind CSS class conflicts using tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const combineClassNames = cn

/**
 * Format date object to string using simple pattern
 * @param date - Date object to format
 * @param formatPattern - Format pattern string
 * @returns Formatted date string
 */
export function formatDateString(date: Date, formatPattern: string): string {
  // Simple date formatting - in production, use date-fns
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12

  if (formatPattern === 'MMM d, yyyy') {
    return `${month} ${day}, ${year}`
  }
  if (formatPattern === 'MMM d, yyyy h:mm a') {
    return `${month} ${day}, ${year} ${hour12}:${minutes} ${ampm}`
  }
  return date.toLocaleDateString()
}

// Backwards compatibility alias
export const format = formatDateString
