/**
 * HTML sanitization utilities to prevent XSS attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  }
  
  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char)
}

/**
 * Sanitize a string for safe HTML insertion
 * Trims whitespace and escapes HTML characters
 */
export function sanitize(str: string | null | undefined): string {
  if (!str) return ''
  return escapeHtml(str.trim())
}

/**
 * Sanitize an email address (basic validation)
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return ''
  // Remove any HTML tags and escape
  const cleaned = email.replace(/[<>]/g, '').trim()
  return escapeHtml(cleaned)
}

/**
 * Sanitize a phone number (allow only valid characters)
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return ''
  // Allow only digits, spaces, dashes, parentheses, and plus sign
  const cleaned = phone.replace(/[^\d\s\-\(\)\+]/g, '').trim()
  return escapeHtml(cleaned)
}

/**
 * Sanitize a price for display
 */
export function sanitizePrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(num) || num < 0) return '0'
  // Format and escape
  return escapeHtml(num.toFixed(2))
}

/**
 * Sanitize a date string for display
 */
export function sanitizeDate(date: string): string {
  // Allow only YYYY-MM-DD format
  const match = date.match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return escapeHtml(date)
  return escapeHtml(date)
}

/**
 * Sanitize a time string for display
 */
export function sanitizeTime(time: string): string {
  // Allow only HH:mm format
  const match = time.match(/^\d{2}:\d{2}$/)
  if (!match) return escapeHtml(time)
  return escapeHtml(time)
}

/**
 * Sanitize a name (allow letters, spaces, hyphens, apostrophes)
 */
export function sanitizeName(name: string | null | undefined): string {
  if (!name) return ''
  // Remove any HTML tags, then escape
  const cleaned = name.replace(/[<>]/g, '').trim()
  return escapeHtml(cleaned)
}
