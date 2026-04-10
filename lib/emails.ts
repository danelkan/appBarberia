import { Resend } from 'resend'
import type { Appointment, Barber, Client, Service } from '@/types'
import { formatDate, formatPrice } from './utils'
import { sanitize, sanitizePhone, sanitizeTime } from './sanitize'

// Raw email normalizer for use in Resend `to:` fields — must NOT HTML-escape
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return ''
  return email.replace(/[<>\s]/g, '').toLowerCase().trim()
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[emails] RESEND_API_KEY is not set — emails will not be sent')  // eslint-disable-line no-console
  }
  return new Resend(key)
}

// Must be a verified sender domain in Resend. Falls back to test address (only
// delivers to account owner in sandbox mode; set RESEND_FROM_EMAIL in production).
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Felito Barber Studio <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://felitostudios.com'

if (!process.env.RESEND_FROM_EMAIL) {
  console.warn('[emails] RESEND_FROM_EMAIL not set — using test sender. Client emails will only reach the Resend account owner.')  // eslint-disable-line no-console
}

const BRAND = {
  ink:    '#0f172a',
  muted:  '#64748b',
  line:   '#e2e8f0',
  bg:     '#f8fafc',
  card:   '#ffffff',
  accent: '#111827',
}

function emailShell({
  eyebrow,
  title,
  intro,
  content,
}: {
  eyebrow: string
  title: string
  intro: string
  content: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Felito Barber Studio</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Inter,Arial,sans-serif;color:${BRAND.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
          <tr>
            <td style="padding-bottom:18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.line};border-radius:28px;background:${BRAND.card};overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;border-bottom:1px solid ${BRAND.line};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="display:inline-flex;align-items:center;gap:12px;">
                            <div style="width:48px;height:48px;border-radius:16px;background:${BRAND.accent};color:#ffffff;font-size:24px;line-height:48px;text-align:center;font-weight:700;">F</div>
                            <div>
                              <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.ink};">Felito Barber Studio</p>
                              <p style="margin:4px 0 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.muted};">${eyebrow}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;color:${BRAND.ink};">${title}</h1>
                    <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:${BRAND.muted};">${intro}</p>
                    ${content}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 32px;">
                    <div style="border-radius:22px;background:${BRAND.bg};border:1px solid ${BRAND.line};padding:18px 20px;">
                      <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                        Felito Barber Studio · Montevideo, Uruguay
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function detailTable(rows: Array<{ label: string; value: string }>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.line};border-radius:22px;overflow:hidden;background:#ffffff;margin-bottom:24px;">
    ${rows.map((row, index) => `
      <tr>
        <td style="padding:14px 18px;border-bottom:${index === rows.length - 1 ? '0' : `1px solid ${BRAND.line}`};font-size:13px;color:${BRAND.muted};width:38%;">${row.label}</td>
        <td style="padding:14px 18px;border-bottom:${index === rows.length - 1 ? '0' : `1px solid ${BRAND.line}`};font-size:14px;font-weight:600;color:${BRAND.ink};text-align:right;">${row.value}</td>
      </tr>
    `).join('')}
  </table>`
}

function ctaButton(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;border-radius:16px;background:${BRAND.accent};padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${label}</a>`
}

export async function sendConfirmationEmail(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const toEmail = normalizeEmail(client.email)
  if (!toEmail) {
    // Client has no email — skip confirmation
    console.log('[emails] sendConfirmationEmail skipped — client has no email')  // eslint-disable-line no-console
    return null
  }

  const safeFirstName = sanitize(client.first_name)
  const safeService   = sanitize(service.name)
  const safePrice     = formatPrice(service.price)
  const safeBarber    = sanitize(barber.name)
  const safeDate      = sanitize(formatDate(appointment.date))
  const safeTime      = sanitizeTime(appointment.start_time.slice(0, 5))

  const result = await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `Turno confirmado · ${safeDate} ${safeTime}`,
    html: emailShell({
      eyebrow: 'Confirmación de turno',
      title: 'Tu turno ya está confirmado',
      intro: `Hola ${safeFirstName}, te compartimos el detalle de tu reserva.`,
      content: `
        ${detailTable([
          { label: 'Servicio', value: `${safeService} · ${safePrice}` },
          { label: 'Barbero',  value: safeBarber },
          { label: 'Fecha',    value: safeDate },
          { label: 'Hora',     value: safeTime },
        ])}
        <div style="margin-top:28px;">
          ${ctaButton('Ver o cancelar turno', `${APP_URL}/mis-turnos`)}
        </div>
      `,
    }),
  })

  if (result.error) {
    console.error('[emails] sendConfirmationEmail failed', { to: toEmail, error: result.error })  // eslint-disable-line no-console
  } else {
    console.log('[emails] sendConfirmationEmail sent', { to: toEmail, id: result.data?.id })  // eslint-disable-line no-console
  }

  return result
}

export async function sendBarberNotification(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const toEmail = normalizeEmail(barber.email)
  if (!toEmail) {
    console.warn('[emails] sendBarberNotification skipped — barber has no email')  // eslint-disable-line no-console
    return null
  }

  const safeDate = sanitize(formatDate(appointment.date))
  const safeTime = sanitizeTime(appointment.start_time.slice(0, 5))

  const result = await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `[Nuevo turno] ${sanitize(client.first_name)} ${sanitize(client.last_name)} · ${safeDate}`,
    html: emailShell({
      eyebrow: 'Nuevo turno',
      title: 'Tenés un nuevo turno',
      intro: `${sanitize(client.first_name)} reservó un turno para vos.`,
      content: `
        ${detailTable([
          { label: 'Cliente',      value: `${sanitize(client.first_name)} ${sanitize(client.last_name)}` },
          { label: 'Teléfono',     value: sanitizePhone(client.phone) },
          { label: 'Servicio',     value: sanitize(service.name) },
          { label: 'Fecha y hora', value: `${safeDate} · ${safeTime}` },
        ])}
        <div style="margin-top:28px;">
          ${ctaButton('Abrir agenda', `${APP_URL}/admin/agenda`)}
        </div>
      `,
    }),
  })

  if (result.error) {
    console.error('[emails] sendBarberNotification failed', { to: toEmail, error: result.error })  // eslint-disable-line no-console
  } else {
    console.log('[emails] sendBarberNotification sent', { to: toEmail, id: result.data?.id })  // eslint-disable-line no-console
  }

  return result
}

export async function sendCancellationEmail(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const toEmail = normalizeEmail(client.email)
  if (!toEmail) return null

  const safeDate = sanitize(formatDate(appointment.date))
  const safeTime = sanitizeTime(appointment.start_time.slice(0, 5))

  const result = await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `Turno cancelado · ${safeDate}`,
    html: emailShell({
      eyebrow: 'Cancelación',
      title: 'Tu turno fue cancelado',
      intro: 'La cancelación se registró correctamente. Podés reservar uno nuevo cuando quieras.',
      content: `
        ${detailTable([
          { label: 'Servicio', value: sanitize(service.name) },
          { label: 'Barbero',  value: sanitize(barber.name) },
          { label: 'Fecha',    value: safeDate },
          { label: 'Hora',     value: safeTime },
        ])}
        <div style="margin-top:28px;">
          ${ctaButton('Reservar nuevo turno', `${APP_URL}/`)}
        </div>
      `,
    }),
  })

  if (result.error) {
    console.error('[emails] sendCancellationEmail failed', { to: toEmail, error: result.error })  // eslint-disable-line no-console
  } else {
    console.log('[emails] sendCancellationEmail sent', { to: toEmail, id: result.data?.id })  // eslint-disable-line no-console
  }

  return result
}

export async function sendBookingEmails(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const results = await Promise.allSettled([
    sendConfirmationEmail(client, barber, service, appointment),
    sendBarberNotification(client, barber, service, appointment),
  ])

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(  // eslint-disable-line no-console
        index === 0 ? '[emails] Client confirmation rejected' : '[emails] Barber notification rejected',
        result.reason
      )
    }
  })

  return results
}
