'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from '@/lib/supabase'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  const config = getSupabasePublicConfig()

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Server Components cannot always write cookies; middleware/API routes handle refreshes.
            }
          })
        },
      },
    }
  )
}
