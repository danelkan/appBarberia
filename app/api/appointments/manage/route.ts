import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { sendCancellationEmail } from '@/lib/emails'
import { checkRateLimit, RateLimitConfigs, rateLimitResponse } from '@/lib/rate-limit'
import { resolveCompanyIdFromBranch } from '@/lib/tenant'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const lookupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(6).max(30),
  branch_id: z.string().uuid().optional(),
  company: z.string().min(1).optional(),
})

async function resolvePublicCompanyId(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  input: { branchId?: string; company?: string }
) {
  if (input.branchId) {
    return resolveCompanyIdFromBranch(supabase, input.branchId)
  }

  if (input.company) {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .or(`id.eq.${input.company},slug.eq.${input.company}`)
      .maybeSingle()

    return (company?.id as string | null) ?? null
  }

  return resolveCompanyIdFromBranch(supabase, null)
}

// GET /api/appointments/manage?email=&phone= — busca turnos del cliente
export async function GET(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 'manage:read', RateLimitConfigs.read)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  const { searchParams } = new URL(req.url)
  const parsed = lookupSchema.safeParse({
    email: searchParams.get('email') ?? '',
    phone: searchParams.get('phone') ?? '',
    branch_id: searchParams.get('branch_id') ?? undefined,
    company: searchParams.get('company') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email y teléfono requeridos' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = await resolvePublicCompanyId(supabase, {
    branchId: parsed.data.branch_id,
    company: parsed.data.company,
  })

  if (!companyId) {
    return NextResponse.json({ error: 'Necesitás entrar desde el enlace de tu barbería o sucursal' }, { status: 400 })
  }

  // Verificar que el cliente exista con ese email Y ese teléfono (doble validación)
  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email, phone')
    .eq('company_id', companyId)
    .eq('email', parsed.data.email)
    .eq('phone', parsed.data.phone)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'No encontramos una cuenta con esos datos' }, { status: 404 })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, date, start_time, end_time, status,
      barber:barbers(id, name),
      service:services(id, name, price, duration_minutes),
      branch:branches(name)
    `)
    .eq('company_id', companyId)
    .eq('client_id', client.id)
    .gte('date', today)
    .neq('status', 'cancelada')
    .order('date')
    .order('start_time')

  return NextResponse.json({ client, appointments: appointments ?? [] })
}

// PATCH /api/appointments/manage — cancela un turno del cliente
export async function PATCH(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 'manage:write', RateLimitConfigs.write)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)!

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const schema = z.object({
    appointment_id: z.string().uuid(),
    email: z.string().email(),
    phone: z.string().min(6).max(30),
    branch_id: z.string().uuid().optional(),
    company: z.string().min(1).optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const companyId = await resolvePublicCompanyId(supabase, {
    branchId: parsed.data.branch_id,
    company: parsed.data.company,
  })

  if (!companyId) {
    return NextResponse.json({ error: 'Necesitás entrar desde el enlace de tu barbería o sucursal' }, { status: 400 })
  }

  // Verificar que el cliente es dueño del turno
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', parsed.data.email)
    .eq('phone', parsed.data.phone)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 403 })
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('*, client:clients(*), barber:barbers(*), service:services(*)')
    .eq('id', parsed.data.appointment_id)
    .eq('company_id', companyId)
    .eq('client_id', client.id)
    .single()

  if (!appt) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  if (appt.status === 'cancelada') {
    return NextResponse.json({ error: 'El turno ya está cancelado' }, { status: 400 })
  }

  // Verificar que faltan más de 2 horas para el turno
  const apptDateTime = new Date(`${appt.date}T${appt.start_time}`)
  const now = new Date()
  const diffHours = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours < 2) {
    return NextResponse.json({
      error: 'Solo podés cancelar un turno con al menos 2 horas de anticipación',
    }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'cancelada' })
    .eq('company_id', companyId)
    .eq('id', appt.id)

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo cancelar el turno' }, { status: 500 })
  }

  if (appt.client) {
    sendCancellationEmail(appt.client, appt.barber, appt.service, appt, {
      companyKey: companyId,
    }).catch(console.error)
  }

  return NextResponse.json({ success: true })
}
