import type { SupabaseClient } from '@supabase/supabase-js'
import webPush from 'web-push'

interface PushSubscriptionRow {
  id: string
  user_id: string
  company_id: string
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

interface PushRecipientRoleRow {
  user_id?: string | null
  active?: boolean | null
  company_id?: string | null
  branch_ids?: unknown
}

export interface PushNotificationPayload {
  title: string
  body: string
  url: string
  tag: string
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

function maskEndpoint(endpoint: string) {
  if (endpoint.length <= 24) return `${endpoint.slice(0, 6)}...`
  return `${endpoint.slice(0, 18)}...${endpoint.slice(-8)}`
}

function isExpiredSubscriptionError(error: any) {
  return error?.statusCode === 404 || error?.statusCode === 410
}

export function resolvePushTargetUserIds(
  roleRows: PushRecipientRoleRow[],
  companyId: string,
  branchId: string
) {
  return Array.from(new Set(roleRows
    .filter(row => {
      if (!row.user_id || row.active === false) return false

      const branchIds = Array.isArray(row.branch_ids)
        ? row.branch_ids.filter((value): value is string => typeof value === 'string')
        : []

      if (row.company_id && row.company_id !== companyId) {
        // Some legacy rows have stale company_id. Only allow them when the
        // branch assignment explicitly matches the appointment branch.
        return branchIds.includes(branchId)
      }

      return branchIds.length === 0 || branchIds.includes(branchId)
    })
    .map(row => row.user_id as string)))
}

export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  payload: PushNotificationPayload,
  context?: { appointmentId?: string }
) {
  if (!configureWebPush()) {
    return { sent: 0, invalid: 0, skipped: 'missing_vapid_config' as const }
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, company_id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('company_id', companyId)

  if (subscriptionError) {
    console.error('[push] subscription lookup failed', {
      user_id: userId,
      company_id: companyId,
      appointment_id: context?.appointmentId,
      error: subscriptionError.message,
    })
    return { sent: 0, invalid: 0, skipped: 'subscription_lookup_failed' as const }
  }

  const rows = (subscriptions ?? []) as PushSubscriptionRow[]
  if (rows.length === 0) {
    console.info('[push] no subscriptions for recipient', { // eslint-disable-line no-console
      user_id: userId,
      company_id: companyId,
      appointment_id: context?.appointmentId,
      subscriptions_found: 0,
    })
    return { sent: 0, invalid: 0, skipped: 'no_subscriptions' as const }
  }

  const message = JSON.stringify(payload)
  let sent = 0
  let invalid = 0

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
      if (isExpiredSubscriptionError(error)) {
        invalid += 1
        await supabase.from('push_subscriptions').delete().eq('id', row.id).eq('company_id', companyId)
        return
      }
      console.error('[push] delivery failed', {
        user_id: userId,
        company_id: companyId,
        appointment_id: context?.appointmentId,
        endpoint: maskEndpoint(row.endpoint),
        statusCode: error?.statusCode,
        message: error?.message,
      })
    }
  }))

  console.info('[push] delivery summary', { // eslint-disable-line no-console
    user_id: userId,
    company_id: companyId,
    appointment_id: context?.appointmentId,
    subscriptions_found: rows.length,
    sent,
    invalid_deleted: invalid,
  })

  return { sent, invalid }
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

  const targetUserIds = resolvePushTargetUserIds(
    (roleRows ?? []) as PushRecipientRoleRow[],
    payload.companyId,
    payload.branchId
  )

  if (targetUserIds.length === 0) {
    console.info('[push] no target user for barber appointment', { // eslint-disable-line no-console
      company_id: payload.companyId,
      appointment_id: payload.appointment.id,
      barber_id: payload.barber.id,
      branch_id: payload.branchId,
    })
    return { sent: 0, skipped: 'no_target_user' as const }
  }

  const clientName = buildClientName(payload.client)
  const notificationPayload = {
    title: 'Nuevo turno asignado',
    body: `${clientName} · ${payload.service.name ?? 'Servicio'} · ${payload.appointment.start_time.slice(0, 5)}`,
    url: `/admin/agenda?date=${payload.appointment.date}`,
    tag: `appointment-${payload.appointment.id}`,
  }

  let sent = 0
  let invalid = 0
  let skipped: string | undefined

  await Promise.all(targetUserIds.map(async userId => {
    const result = await sendPushToUser(supabase, userId, payload.companyId, notificationPayload, {
      appointmentId: payload.appointment.id,
    })
    sent += result.sent
    invalid += result.invalid
    if ('skipped' in result && result.skipped) skipped = result.skipped
  }))

  return sent > 0 ? { sent, invalid } : { sent, invalid, skipped: skipped ?? 'no_subscriptions' as const }
}
