/**
 * App-level brand & runtime configuration.
 * All values read from environment variables so the same codebase
 * can be deployed for any barbershop without code changes.
 */

export interface AppConfig {
  /** Barbershop display name. Used in emails, page titles, admin sidebar. */
  name: string
  /** Short location label shown in email footers (e.g. "Montevideo, Uruguay"). */
  location: string
  /** Public URL of the app, used for email links. */
  url: string
  /** First letter of name, used as logo placeholder initial. */
  logoInitial: string
  /** Contact / support email address. */
  supportEmail: string
}

export function getAppConfig(): AppConfig {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? 'Barber Studio'
  return {
    name,
    location:     process.env.APP_LOCATION     ?? '',
    url:          process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    logoInitial:  name.charAt(0).toUpperCase(),
    supportEmail: process.env.APP_SUPPORT_EMAIL ?? '',
  }
}

/** Convenience singleton — safe to call at module level in server code. */
export const appConfig = getAppConfig()
