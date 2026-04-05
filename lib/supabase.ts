import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
    signInWithPassword: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
} as unknown as SupabaseClient

export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return ssrStub
  }

  return createBrowserClient(url, key)
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient(url, key, {
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
