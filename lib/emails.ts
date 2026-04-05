import { Resend } from 'resend'
import type { Appointment, Client, Barber, Service } from '@/types'
import { formatDate, formatPrice } from './utils'
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeTime } from './sanitize'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Felito Studios <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://felitostudios.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@felitostudios.com'

// ─── Confirmation to client ───────────────────────────────────────
export async function sendConfirmationEmail(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const dateStr = sanitize(formatDate(appointment.date))
  const safeFirstName = sanitize(client.first_name)
  const safeServiceName = sanitize(service.name)
  const safePrice = formatPrice(service.price)
  const safeBarberName = sanitize(barber.name)
  const safeTime = sanitizeTime(appointment.start_time.slice(0, 5))

  const html = `
    <div style="font-family:Georgia,serif;background:#0f0f0f;color:#fafaf8;padding:40px;max-width:500px;margin:0 auto;border-radius:8px;">
      <div style="border-bottom:1px solid #c9a84c;padding-bottom:20px;margin-bottom:24px;">
        <h1 style="color:#c9a84c;font-size:22px;margin:0;">Felito Studios</h1>
        <p style="color:#888;font-size:13px;margin:4px 0 0;">Confirmación de turno</p>
      </div>
      <p style="margin-bottom:20px;">Hola <strong>${safeFirstName}</strong>, tu turno está confirmado.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Servicio</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safeServiceName} — ${safePrice}</td></tr>
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Barbero</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safeBarberName}</td></tr>
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Fecha</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;text-transform:capitalize;">${dateStr}</td></tr>
        <tr><td style="color:#888;padding:8px 0;font-size:13px;">Hora</td><td style="padding:8px 0;text-align:right;color:#c9a84c;font-weight:bold;">${safeTime}</td></tr>
      </table>
      <div style="margin-top:24px;padding:16px;background:#1a1a1a;border-radius:6px;border-left:3px solid #c9a84c;">
        <p style="margin:0;font-size:13px;color:#888;">Si necesitás cancelar o reprogramar tu turno, contactanos por WhatsApp.</p>
      </div>
      <p style="margin-top:24px;font-size:12px;color:#555;text-align:center;">Felito Studios · Montevideo, Uruguay</p>
    </div>`

  return resend.emails.send({
    from: FROM,
    to: sanitizeEmail(client.email),
    subject: `Turno confirmado — ${dateStr} a las ${safeTime}`,
    html,
  })
}

// ─── New appointment notification to admin ────────────────────────
export async function sendAdminNotification(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const dateStr = sanitize(formatDate(appointment.date))
  const safeFirstName = sanitize(client.first_name)
  const safeLastName = sanitize(client.last_name)
  const safeEmail = sanitizeEmail(client.email)
  const safePhone = sanitizePhone(client.phone)
  const safeServiceName = sanitize(service.name)
  const safeBarberName = sanitize(barber.name)
  const safeTime = sanitizeTime(appointment.start_time.slice(0, 5))

  const html = `
    <div style="font-family:Georgia,serif;background:#0f0f0f;color:#fafaf8;padding:40px;max-width:500px;margin:0 auto;border-radius:8px;">
      <h2 style="color:#c9a84c;margin-top:0;">Nuevo turno reservado</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Cliente</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safeFirstName} ${safeLastName}</td></tr>
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Email</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safeEmail}</td></tr>
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Teléfono</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safePhone}</td></tr>
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Servicio</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safeServiceName}</td></tr>
        <tr><td style="color:#888;padding:8px 0;border-bottom:1px solid #2e2e2e;font-size:13px;">Barbero</td><td style="padding:8px 0;border-bottom:1px solid #2e2e2e;text-align:right;">${safeBarberName}</td></tr>
        <tr><td style="color:#888;padding:8px 0;font-size:13px;">Fecha y hora</td><td style="padding:8px 0;text-align:right;color:#c9a84c;">${dateStr} — ${safeTime}</td></tr>
      </table>
      <a href="${APP_URL}/admin/agenda" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#c9a84c;color:#0f0f0f;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Ver agenda →</a>
    </div>`

  return resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[Nuevo turno] ${safeFirstName} ${safeLastName} — ${dateStr}`,
    html,
  })
}

// ─── Cancellation to client ───────────────────────────────────────
export async function sendCancellationEmail(
  client: Client,
  barber: Barber,
  service: Service,
  appointment: Appointment
) {
  const dateStr = sanitize(formatDate(appointment.date))
  const safeFirstName = sanitize(client.first_name)
  const safeTime = sanitizeTime(appointment.start_time.slice(0, 5))

  const html = `
    <div style="font-family:Georgia,serif;background:#0f0f0f;color:#fafaf8;padding:40px;max-width:500px;margin:0 auto;border-radius:8px;">
      <h2 style="color:#ef4444;margin-top:0;">Turno cancelado</h2>
      <p>Hola <strong>${safeFirstName}</strong>, lamentamos informarte que tu turno del <strong>${dateStr} a las ${safeTime}</strong> fue cancelado.</p>
      <p style="color:#888;font-size:14px;">Para reservar un nuevo turno, podés hacerlo desde nuestra web.</p>
      <a href="${APP_URL}/reservar" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#c9a84c;color:#0f0f0f;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Reservar nuevo turno →</a>
    </div>`

  return resend.emails.send({
    from: FROM,
    to: sanitizeEmail(client.email),
    subject: `Turno cancelado — ${dateStr}`,
    html,
  })
}
