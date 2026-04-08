import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface SupabasePublicConfig {
  url: string
  anonKey: string
}

interface SupabaseAdminConfig extends SupabasePublicConfig {
  serviceRoleKey: string
}

function validateSupabaseUrl(rawUrl: string, envName: string) {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error(`${envName} must be a valid URL`)
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`${envName} must use http or https`)
  }

  if (parsedUrl.hostname === 'your-project.supabase.co') {
    throw new Error(`${envName} still uses the placeholder host`)
  }

  return parsedUrl.toString().replace(/\/$/, '')
}

function validateSupabaseKey(rawKey: string, envName: string) {
  if (rawKey.trim().split('.').length !== 3) {
    throw new Error(`${envName} must be a valid JWT key`)
  }

  return rawKey.trim()
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  return {
    url: validateSupabaseUrl(url, 'NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: validateSupabaseKey(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

export function getOptionalSupabasePublicConfig(): SupabasePublicConfig | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }

  return getSupabasePublicConfig()
}

export function getSupabaseAdminConfig(): SupabaseAdminConfig {
  const publicConfig = getSupabasePublicConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return {
    ...publicConfig,
    serviceRoleKey: validateSupabaseKey(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
  }
}

export function formatSupabaseError(error: unknown) {
  if (error instanceof Error) {
    const causeCode =
      typeof error.cause === 'object' &&
      error.cause !== null &&
      'code' in error.cause &&
      typeof (error.cause as { code?: unknown }).code === 'string'
        ? (error.cause as { code: string }).code
        : undefined

    return causeCode ? `${error.message} (${causeCode})` : error.message
  }

  return String(error)
}

/**
 * Creates a Supabase client for browser/client-side use.
 * Uses the public anon key - subject to RLS policies.
 * 
 * Use this in:
 * - Client components ('use client')
 * - Client-side fetch calls
 */
// SSR-safe stub — used only during server-side prerender when env vars aren't available.
// All real auth calls happen in the browser (event handlers / useEffect) where env vars are set.
const ssrStub = {
  auth: {
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: {
        message: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      },
    }),
    signOut: async () => ({
      error: {
        message: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      },
    }),
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
} as unknown as SupabaseClient

export function createSupabaseBrowserClient(): SupabaseClient {
  const config = getOptionalSupabasePublicConfig()

  if (!config) {
    return ssrStub
  }

  return createBrowserClient(config.url, config.anonKey)
}

export function createSupabaseServerReadClient(): SupabaseClient {
  const config = getSupabasePublicConfig()
  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Creates a Supabase admin client with service role key.
 * Bypasses Row Level Security (RLS) - USE WITH CAUTION.
 * 
 * Only use this in:
 * - API routes (server-side only)
 * - Server actions
 * - Server components with sensitive operations
 * 
 * NEVER expose this client to the browser!
 */
export function createSupabaseAdmin(): SupabaseClient {
  const config = getSupabaseAdminConfig()

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Type alias for Supabase client
 */
export type Database = SupabaseClient
