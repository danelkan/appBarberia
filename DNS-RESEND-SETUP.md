# DNS + Resend — Guía de configuración de emails

## Estado actual

| Variable | Estado | Impacto |
|---|---|---|
| `RESEND_API_KEY` | ✅ Configurada | Resend funciona |
| `RESEND_FROM_EMAIL` | ❌ No configurada | **Emails solo llegan al owner de Resend, no a clientes** |
| `NEXT_PUBLIC_APP_URL` | ⚠️ localhost:3000 en .env.local | Links en emails apuntan a localhost |

## Pasos para producción

### 1. Configurar dominio en Resend

1. Ir a https://resend.com/domains
2. Agregar dominio: `felitostudios.com` (o el dominio final)
3. Resend te va a dar registros DNS para agregar

### 2. Agregar registros DNS (en tu proveedor de dominio)

Resend requiere estos registros para verificar el dominio y mejorar entregabilidad:

```
# SPF — autoriza a Resend a enviar en nombre de tu dominio
TXT  @    v=spf1 include:spf.resend.com ~all

# DKIM — firma criptográfica de los emails
TXT  resend._domainkey    [valor que te da Resend, ej: p=MIIBIj...]

# DMARC — política de rechazo de spoofing
TXT  _dmarc    v=DMARC1; p=quarantine; rua=mailto:dmarc@felitostudios.com
```

> Los valores exactos de SPF y DKIM los tenés que copiar desde el panel de Resend.

### 3. Configurar variables de entorno en Vercel

En Vercel → tu proyecto → Settings → Environment Variables:

```
RESEND_FROM_EMAIL=Felito Barber Studio <noreply@felitostudios.com>
NEXT_PUBLIC_APP_URL=https://felitostudios.com
```

> `RESEND_FROM_EMAIL` debe usar un email del dominio verificado en Resend.
> El formato `Nombre <email@dominio.com>` es válido y mejora la presentación.

### 4. Verificar

Después de agregar los registros DNS (puede tardar hasta 48h en propagarse):

1. En Resend → Domains → tu dominio → Status debe mostrar "Verified"
2. Hacé una reserva de prueba y verificá que el email llegue al cliente (no solo al owner)
3. Revisá que los links en el email apunten a la URL de producción

## Emails implementados

| Trigger | Destinatario | Archivo |
|---|---|---|
| Nueva reserva | Cliente | `lib/emails.ts:sendConfirmationEmail` |
| Nueva reserva | Barbero | `lib/emails.ts:sendBarberNotification` |
| Cancelación | Cliente | `lib/emails.ts:sendCancellationEmail` |

## Emails pendientes de implementar

- Recordatorio 24h antes del turno (requiere cron job)
- Comprobante de pago por email (post-cobro)
- Campaña de cumpleaños (requiere campo `birthdate` en `clients`)

## WhatsApp como canal adicional

Ver `lib/whatsapp.ts` para la estructura preparada.
Requiere cuenta Twilio o Meta Business con WhatsApp API aprobada.
Es una feature opcional/premium por plan (ver `types/index.ts:PLAN_LIMITS`).
