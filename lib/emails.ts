import { Resend } from 'resend'
import type { Appointment, Client, Barber, Service } from '@/types'
import { formatDate, formatPrice } from './utils'
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeTime } from './sanitize'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
const FROM       = process.env.RESEND_FROM_EMAIL ?? 'Felito Studios <onboarding@resend.dev>'
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://felitostudios.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@felitostudios.com'

// ─── Shared design tokens ─────────────────────────────────────────
const GOLD  = '#C9A84C'
const DARK  = '#1a1a1a'
const GRAY  = '#6B7280'
const LIGHT = '#F9FAFB'
const BORDER = '#E5E7EB'

function emailBase(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Felito Barber Studio</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="background:${DARK};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;background:${GOLD};border-radius:8px;display:inline-block;"></div>
            <div style="text-align:left;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:0.02em;">Felito Barber Studio</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.08em;text-transform:uppercase;">Montevideo, Uruguay</p>
            </div>
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#FFFFFF;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};padding:36px 32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${LIGHT};border:1px solid ${BORDER};border-top:0;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${GRAY};">Felito Barber Studio · Montevideo, Uruguay</p>
          <p style="margin:6px 0 0;font-size:11px;color:#9CA3AF;">Si no realizaste esta reserva, podés ignorar este email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function dataRow(label: string, value: string, highlight = false): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${GRAY};width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;font-weight:600;color:${highlight ? GOLD : DARK};text-align:right;">${value}</td>
  </tr>`
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${GOLD};color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:0.01em;">${label}</a>`
}

// ─── Confirmation to client ───────────────────────────────────────
export async function sendConfirmationEmail(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const dateStr       = sanitize(formatDate(appointment.date))
  const safeFirstName = sanitize(client.first_name)
  const safeService   = sanitize(service.name)
  const safePrice     = formatPrice(service.price)
  const safeBarber    = sanitize(barber.name)
  const safeTime      = sanitizeTime(appointment.start_time.slice(0, 5))

  const content = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:${DARK};">¡Tu turno está confirmado!</h2>
    <p style="margin:0 0 28px;font-size:15px;color:${GRAY};">Hola <strong style="color:${DARK};">${safeFirstName}</strong>, te esperamos.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      ${dataRow('Servicio', `${safeService} · ${safePrice}`)}
      ${dataRow('Barbero', safeBarber)}
      ${dataRow('Fecha', `<span style="text-transform:capitalize;">${dateStr}</span>`)}
      ${dataRow('Hora', safeTime, true)}
    </table>

    <div style="background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:13px;color:${GRAY};">¿Necesitás cancelar? Podés hacerlo hasta 2 horas antes desde el link de abajo.</p>
      ${ctaButton(`${APP_URL}/mis-turnos`, 'Ver / cancelar mi turno →')}
    </div>
  `

  return getResend().emails.send({
    from: FROM,
    to: sanitizeEmail(client.email),
    subject: `Turno confirmado · ${dateStr} a las ${safeTime}`,
    html: emailBase(content),
  })
}

// ─── Admin notification ───────────────────────────────────────────
export async function sendAdminNotification(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const dateStr     = sanitize(formatDate(appointment.date))
  const safeName    = `${sanitize(client.first_name)} ${sanitize(client.last_name)}`
  const safeEmail   = sanitizeEmail(client.email)
  const safePhone   = sanitizePhone(client.phone)
  const safeService = sanitize(service.name)
  const safeBarber  = sanitize(barber.name)
  const safeTime    = sanitizeTime(appointment.start_time.slice(0, 5))

  const content = `
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${DARK};">Nuevo turno reservado</h2>
    <p style="margin:0 0 24px;font-size:14px;color:${GRAY};">Se recibió una nueva reserva.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      ${dataRow('Cliente', safeName)}
      ${dataRow('Email', safeEmail)}
      ${dataRow('Teléfono', safePhone)}
      ${dataRow('Servicio', safeService)}
      ${dataRow('Barbero', safeBarber)}
      ${dataRow('Fecha y hora', `${dateStr} · ${safeTime}`, true)}
    </table>

    ${ctaButton(`${APP_URL}/admin/agenda`, 'Ver en la agenda →')}
  `

  return getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[Nuevo turno] ${sanitize(client.first_name)} ${sanitize(client.last_name)} · ${dateStr}`,
    html: emailBase(content),
  })
}

// ─── Cancellation to client ───────────────────────────────────────
export async function sendCancellationEmail(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const dateStr       = sanitize(formatDate(appointment.date))
  const safeFirstName = sanitize(client.first_name)
  const safeTime      = sanitizeTime(appointment.start_time.slice(0, 5))
  const safeService   = sanitize(service.name)
  const safeBarber    = sanitize(barber.name)

  const content = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:${DARK};">Turno cancelado</h2>
    <p style="margin:0 0 24px;font-size:15px;color:${GRAY};">Hola <strong style="color:${DARK};">${safeFirstName}</strong>, tu turno fue cancelado correctamente.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      ${dataRow('Servicio', safeService)}
      ${dataRow('Barbero', safeBarber)}
      ${dataRow('Fecha', `<span style="text-transform:capitalize;">${dateStr}</span>`)}
      ${dataRow('Hora', safeTime)}
    </table>

    <div style="background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:13px;color:${GRAY};">Podés reservar un nuevo turno cuando quieras.</p>
      ${ctaButton(`${APP_URL}/reservar`, 'Reservar nuevo turno →')}
    </div>
  `

  return getResend().emails.send({
    from: FROM,
    to: sanitizeEmail(client.email),
    subject: `Turno cancelado · ${dateStr}`,
    html: emailBase(content),
  })
}

// ─── Send both booking emails ─────────────────────────────────────
export async function sendBookingEmails(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const results = await Promise.allSettled([
    sendConfirmationEmail(client, barber, service, appointment),
    sendAdminNotification(client, barber, service, appointment),
  ])

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        index === 0 ? 'Client confirmation email failed' : 'Admin notification email failed',
        result.reason
      )
    }
  })

  return results
}
