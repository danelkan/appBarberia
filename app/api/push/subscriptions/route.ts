import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { requireAuth, unauthorizedResponse } from '@/lib/api-auth'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface BrowserPushSubscription {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'push:write', RateLimitConfigs.write)
  if (!rl.allowed) return rateLimitResponse(rl)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const subscription = await req.json().catch(() => null) as BrowserPushSubscription | null
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: auth.session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers.get('user-agent'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) {
    if (error.message.toLowerCase().includes('push_subscriptions')) {
      return NextResponse.json({
        error: 'La tabla push_subscriptions no existe. Aplicá supabase-migration-v15.sql.',
        code: 'push_table_missing',
      }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, 'push:read', RateLimitConfigs.authedRead)
  if (!rl.allowed) return rateLimitResponse(rl)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const supabase = createSupabaseAdmin()
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.session.user.id)

  if (error) {
    if (error.message.toLowerCase().includes('push_subscriptions')) {
      return NextResponse.json({
        ready: false,
        count: 0,
        code: 'push_table_missing',
        error: 'La tabla push_subscriptions no existe. Aplicá supabase-migration-v15.sql.',
      }, { status: 500 })
    }
    return NextResponse.json({ ready: false, count: 0, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ready: true, count: count ?? 0 })
}

export async function DELETE(req: NextRequest) {
  const rl = checkRateLimit(req, 'push:write', RateLimitConfigs.write)
  if (!rl.allowed) return rateLimitResponse(rl)!

  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const body = await req.json().catch(() => null) as { endpoint?: string } | null
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', auth.session.user.id)
    .eq('endpoint', body.endpoint)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
