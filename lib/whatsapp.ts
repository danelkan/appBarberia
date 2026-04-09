/**
 * WhatsApp Messaging — Preparación para integración futura
 *
 * ─── OPCIONES DE PROVEEDOR ────────────────────────────────────────
 *
 * 1. Twilio (recomendado para iniciar)
 *    - API madura, buena doc, trial gratis con sandbox
 *    - Cost: ~USD 0.005 por mensaje outbound (template)
 *    - Requiere: cuenta Twilio + número WhatsApp Business aprobado por Meta
 *    - Env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WA_NUMBER
 *
 * 2. Meta Cloud API (oficial, gratis hasta 1000 conv/mes)
 *    - Requiere: Meta Business account + WhatsApp Business app + número verificado
 *    - Env vars: META_WA_TOKEN, META_WA_PHONE_NUMBER_ID
 *
 * 3. Gupshup / Wati / 360Dialog (wrappers sobre Meta Cloud API)
 *    - Más fácil de configurar, algunos tienen plan free tier
 *
 * ─── QUÉ SE PUEDE AUTOMATIZAR HOY (SIN COSTO EXTRA DE DESARROLLO) ─
 *
 * - Confirmación de turno al reservar (trigger: POST /api/appointments)
 * - Recordatorio 24h antes (requiere cron job / scheduled task)
 * - Mensaje de cumpleaños con beneficio (requiere cron + columna birthdate en clients)
 *
 * ─── QUÉ REQUIERE PROVIDER/APROBACIÓN META ───────────────────────
 *
 * Los mensajes OUTBOUND (de negocio a cliente) requieren usar
 * "Message Templates" pre-aprobados por Meta. No se pueden enviar
 * mensajes libres hasta que el cliente te responda primero.
 *
 * Templates necesarios a crear en Meta Business:
 *   - "turno_confirmado": "Hola {{name}}, tu turno en Felito para {{service}} el {{date}} a las {{time}} está confirmado."
 *   - "recordatorio_turno": "Te recordamos tu turno mañana {{date}} a las {{time}} en Felito."
 *   - "cumpleanos": "¡Feliz cumpleaños {{name}}! 🎂 Presentá tu cédula este mes y obtené 50% off en tu próximo servicio."
 *
 * ─── ESTRUCTURA DE IMPLEMENTACIÓN ────────────────────────────────
 *
 * La tabla `whatsapp_messages` (migration v6) ya está preparada.
 * El flujo sería:
 *   1. Al crear un turno → insert en whatsapp_messages (status: pending, type: confirmation)
 *   2. Cron cada 5min → procesa pending messages → llama sendWhatsAppMessage()
 *   3. Para recordatorios → cron diario → busca turnos del día siguiente → inserta messages
 *   4. Para cumpleaños → cron diario → busca clients con birthdate = hoy → inserta messages
 */

interface WhatsAppMessageParams {
  to: string        // Phone number with country code, e.g. "+59899123456"
  templateName: string
  language?: string
  components?: WhatsAppTemplateComponent[]
}

interface WhatsAppTemplateComponent {
  type: 'body' | 'header' | 'button'
  parameters: Array<{ type: 'text'; text: string }>
}

// ─── Twilio implementation (swap to Meta Cloud API as needed) ─────
export async function sendWhatsAppMessage(params: WhatsAppMessageParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WA_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[whatsapp] Twilio env vars not set — message not sent', { to: params.to, template: params.templateName })
    return { success: false, error: 'WhatsApp provider not configured' }
  }

  try {
    const bodyText = buildTemplateText(params.templateName, params.components)

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          From: `whatsapp:${fromNumber}`,
          To: `whatsapp:${params.to}`,
          Body: bodyText,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('[whatsapp] Twilio error', data)
      return { success: false, error: data.message ?? 'Twilio error' }
    }

    return { success: true, messageId: data.sid }
  } catch (err) {
    console.error('[whatsapp] sendWhatsAppMessage exception', err)
    return { success: false, error: String(err) }
  }
}

// Simple template renderer — in production use the actual Meta template system
function buildTemplateText(templateName: string, components?: WhatsAppTemplateComponent[]): string {
  const params = components
    ?.find(c => c.type === 'body')
    ?.parameters?.map(p => p.text) ?? []

  const TEMPLATES: Record<string, (...args: string[]) => string> = {
    turno_confirmado: (name, service, date, time) =>
      `Hola ${name}, tu turno en Felito para ${service} el ${date} a las ${time} está confirmado. ✂️`,
    recordatorio_turno: (name, date, time) =>
      `Hola ${name}, te recordamos tu turno mañana ${date} a las ${time} en Felito. ✂️ ¿Necesitás cancelar? Avisanos con anticipación.`,
    cumpleanos: (name) =>
      `¡Feliz cumpleaños ${name}! 🎂 Como regalo de Felito Barber Studio, presentá tu cédula este mes y obtené 50% OFF en tu próximo servicio. ¡Te esperamos!`,
  }

  return (TEMPLATES[templateName] ?? (() => `Mensaje de Felito Barber Studio.`))(...params)
}

// ─── Birthday campaign helper ─────────────────────────────────────
export interface BirthdayMessage {
  clientPhone: string
  clientName: string
}

export async function queueBirthdayMessages(clients: BirthdayMessage[]) {
  return Promise.allSettled(
    clients.map(client =>
      sendWhatsAppMessage({
        to: client.clientPhone,
        templateName: 'cumpleanos',
        components: [{ type: 'body', parameters: [{ type: 'text', text: client.clientName }] }],
      })
    )
  )
}
