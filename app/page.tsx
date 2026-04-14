import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import { resolveUserRole } from '@/lib/api-auth'
import { createSupabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BrandLogo } from '@/components/brand-logo'
import { buildCompanyScopeFilter, resolveCompanyId, resolveCompanyRecordByIdentifier, resolveSingleCompanyLegacyScope } from '@/lib/tenant'

interface HomePageProps {
  searchParams: {
    company?: string
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Felito Barber Studio — Reserva tu turno',
  description: 'Elegí sucursal y reservá online en Felito Barber Studio, Montevideo.',
}

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore()

  const supabase = createSupabaseAdmin()
  const serverSupabase = createSupabaseServerClient()
  const companyParam = searchParams.company?.trim()
  const {
    data: { user },
  } = await serverSupabase.auth.getUser()

  let authCompanyId: string | null = null
  let isSuperadmin = false
  if (user) {
    const resolvedRole = await resolveUserRole(supabase, user.id, user.email)
    if (resolvedRole.active && resolvedRole.role === 'superadmin') {
      isSuperadmin = true
    } else if (resolvedRole.active) {
      authCompanyId = await resolveCompanyId(
        {
          ...resolvedRole,
          session: { user: { id: user.id, email: user.email ?? undefined } },
          response: undefined,
        },
        supabase
      )
    }
  }
  const effectiveCompanyParam = companyParam ?? authCompanyId ?? undefined

  const baseCompanyQuery = supabase
    .from('companies')
    .select('id, name, slug')
    .eq('active', true)
    .order('created_at')

  const resolvedCompany = effectiveCompanyParam
    ? await resolveCompanyRecordByIdentifier(supabase, effectiveCompanyParam)
    : null

  const { data: scopedCompanies } = resolvedCompany
    ? await baseCompanyQuery.eq('id', resolvedCompany.id)
    : { data: null as Array<{ id: string; name: string; slug: string | null }> | null }

  const { data: allCompanies } = !resolvedCompany
    ? await supabase
        .from('companies')
        .select('id, name, slug')
        .eq('active', true)
        .order('created_at')
    : { data: null as Array<{ id: string; name: string; slug: string | null }> | null }

  const activeCompanies = (scopedCompanies?.length ? scopedCompanies : allCompanies) ?? []
  const selectedCompany = effectiveCompanyParam
    ? scopedCompanies?.[0] ?? null
    : activeCompanies.length === 1 ? activeCompanies[0] : null

  // Solo superadmin puede ver la lista de todas las empresas
  const visibleCompanies = (!selectedCompany && !isSuperadmin) ? [] : activeCompanies

  const companyScope = selectedCompany
    ? await resolveSingleCompanyLegacyScope(supabase, selectedCompany.id)
    : null
  const { data: branches } = selectedCompany
    ? await supabase
        .from('branches')
        .select('id, name, address')
        .eq('active', true)
        .or(buildCompanyScopeFilter('company_id', selectedCompany.id, companyScope?.allowLegacyUnscoped))
        .order('name')
    : { data: [] }
  const { data: allActiveBranches } = !selectedCompany
    ? await supabase
        .from('branches')
        .select('company_id')
        .eq('active', true)
    : { data: [] as Array<{ company_id: string | null }> }

  const companyQueryValue = selectedCompany?.slug ?? selectedCompany?.id ?? null
  const hasVisibleBranches = Boolean((branches ?? []).length)
  const branchCountByCompany = new Map<string, number>()
  for (const branch of allActiveBranches ?? []) {
    if (!branch.company_id) continue
    branchCountByCompany.set(branch.company_id, (branchCountByCompany.get(branch.company_id) ?? 0) + 1)
  }

  return (
    <main className="flex min-h-screen flex-col px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">

        {/* Header */}
        <header className="flex items-center">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} className="rounded-xl" />
            <div>
              <p className="text-sm font-semibold text-slate-950">Felito Barber Studio</p>
              <p className="text-xs text-slate-400">Montevideo</p>
            </div>
          </div>
        </header>

        {/* Branch selection */}
        <section className="flex flex-1 flex-col justify-center py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Reserva online
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {selectedCompany ? 'Elegí tu sucursal' : 'Elegí tu barbería'}
          </h1>
          {!selectedCompany && !isSuperadmin && (
            <p className="mt-2 text-sm text-slate-500">
              Accedé desde el enlace propio de tu barbería para reservar tu turno.
            </p>
          )}
          {!selectedCompany && isSuperadmin && (
            <p className="mt-2 text-sm text-slate-500">
              Seleccioná una empresa para ver sus sucursales.
            </p>
          )}

          <div className="mt-5 space-y-3">
            {!selectedCompany ? (
              visibleCompanies.map(company => (
                <Link
                  key={company.id}
                  href={`/?company=${company.slug ?? company.id}`}
                  className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-150 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                    <MapPin className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950">{company.name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {branchCountByCompany.get(company.id) ?? 0} sucursal{(branchCountByCompany.get(company.id) ?? 0) === 1 ? '' : 'es'}
                    </p>
                  </div>

                  <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-950" />
                </Link>
              ))
            ) : !hasVisibleBranches ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-base font-medium text-slate-700">
                  No encontramos sucursales activas para esta barbería.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Revisá en la base que exista al menos una fila en <code>branches</code> con{' '}
                  <code>company_id = {selectedCompany.id}</code> y <code>active = true</code>.
                </p>
                <div className="mt-4">
                  <Link
                    href="/"
                    className="text-sm font-medium text-slate-700 underline-offset-4 transition hover:text-slate-950 hover:underline"
                  >
                    Volver a elegir barbería
                  </Link>
                </div>
              </div>
            ) : (
              (branches ?? []).map(branch => (
                <Link
                  key={branch.id}
                  href={`/reservar?branch=${branch.id}${companyQueryValue ? `&company=${companyQueryValue}` : ''}`}
                  className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-150 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                    <MapPin className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950">{selectedCompany.name}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {branch.address ?? branch.name}
                    </p>
                  </div>

                  <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-950" />
                </Link>
              ))
            )}
          </div>

          <div className="mt-5 text-center">
            {companyQueryValue ? (
              <Link
                href={`/mis-turnos?company=${companyQueryValue}`}
                className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-700 hover:underline"
              >
                Ver o cancelar mis turnos
              </Link>
            ) : (
              <span className="text-sm text-slate-400">
                Ver o cancelar mis turnos
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
