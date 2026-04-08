import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getSupabasePublicConfig } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  let response = NextResponse.next({ request: req })
  const config = getSupabasePublicConfig()

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: req })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: req })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
