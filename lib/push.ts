import type { SupabaseClient } from '@supabase/supabase-js'
import webPush from 'web-push'

interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface AppointmentPushPayload {
  appointment: {
    id: string
    date: string
    start_time: string
    end_time?: string | null
  }
  barber: {
    id: string
    name?: string | null
  }
  service: {
    name?: string | null
  }
  branchId: string
  companyId: string
  client?: {
    first_name?: string | null
    last_name?: string | null
  } | null
}

let configured = false

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    ?? process.env.VAPID_PUBLIC_KEY
    ?? null
}

function configureWebPush() {
  if (configured) return true

  const publicKey = getVapidPublicKey()
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? `mailto:${process.env.ADMIN_EMAIL ?? 'admin@example.com'}`,
    publicKey,
    privateKey
  )
  configured = true
  return true
}

function buildClientName(client: AppointmentPushPayload['client']) {
  const name = `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim()
  return name || 'Nuevo cliente'
}

export async function notifyBarberForAppointment(
  supabase: SupabaseClient,
  payload: AppointmentPushPayload
) {
  if (!configureWebPush()) {
    return { sent: 0, skipped: 'missing_vapid_config' as const }
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id, active, company_id, branch_ids')
    .eq('barber_id', payload.barber.id)
    .eq('active', true)

  if (roleError) {
    console.error('Push role lookup failed:', roleError)
    return { sent: 0, skipped: 'role_lookup_failed' as const }
  }

  const targetUserIds = Array.from(new Set((roleRows ?? [])
    .filter((row: any) => {
      if (!row.user_id) return false
      if (row.company_id && row.company_id !== payload.companyId) return false
      const branchIds = Array.isArray(row.branch_ids) ? row.branch_ids : []
      return branchIds.length === 0 || branchIds.includes(payload.branchId)
    })
    .map((row: any) => row.user_id as string)))

  if (targetUserIds.length === 0) {
    return { sent: 0, skipped: 'no_target_user' as const }
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', targetUserIds)

  if (subscriptionError) {
    console.error('Push subscription lookup failed:', subscriptionError)
    return { sent: 0, skipped: 'subscription_lookup_failed' as const }
  }

  const rows = (subscriptions ?? []) as PushSubscriptionRow[]
  if (rows.length === 0) {
    return { sent: 0, skipped: 'no_subscriptions' as const }
  }

  const clientName = buildClientName(payload.client)
  const message = JSON.stringify({
    title: 'Nuevo turno asignado',
    body: `${clientName} · ${payload.service.name ?? 'Servicio'} · ${payload.appointment.start_time.slice(0, 5)}`,
    url: `/admin/agenda?date=${payload.appointment.date}`,
    tag: `appointment-${payload.appointment.id}`,
  })

  let sent = 0
  await Promise.all(rows.map(async row => {
    try {
      await webPush.sendNotification({
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      }, message)
      sent += 1
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id)
        return
      }
      console.error('Push delivery failed:', error)
    }
  }))

  return { sent }
}
