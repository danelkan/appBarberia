import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('multi-tenant regression audit', () => {
  it('scopes sensitive payment reads and writes by company_id', () => {
    const source = readRepoFile('app/api/payments/route.ts')

    expect(source).toContain("company_id: effectiveCompanyId")
    expect(source).toContain("query = query.in('appointment_id', appointmentIds)")
    expect(source).toContain("existingPaymentQuery = existingPaymentQuery.eq('company_id', effectiveCompanyId)")
  })

  it('requires company scope when updating or deleting appointments by id', () => {
    const source = readRepoFile('app/api/appointments/[id]/route.ts')

    expect(source).toContain("query = query.eq('company_id', companyId)")
  })

  it('prevents public appointment management from running without tenant context', () => {
    const source = readRepoFile('app/api/appointments/manage/route.ts')

    expect(source).toContain('resolvePublicCompanyId')
    expect(source).toContain('Necesitás entrar desde el enlace de tu barbería o sucursal')
    expect(source).toContain(".eq('company_id', companyId)")
  })

  it('scopes service listings and mutations to a tenant', () => {
    const listSource = readRepoFile('app/api/services/route.ts')
    const itemSource = readRepoFile('app/api/services/[id]/route.ts')

    expect(listSource).toContain('effectiveCompanyId')
    expect(listSource).toContain("query = query.eq('company_id', effectiveCompanyId)")
    expect(itemSource).toContain("query = query.eq('company_id', companyId)")
  })

  it('stops the public home page from listing branches across all tenants', () => {
    const source = readRepoFile('app/page.tsx')

    expect(source).toContain(".eq('company_id', selectedCompany.id)")
    expect(source).toContain('Accedé desde el enlace propio de tu barbería')
  })

  it('stores the active admin branch per company instead of globally', () => {
    const source = readRepoFile('app/admin/layout.tsx')

    expect(source).toContain('ACTIVE_BRANCH_STORAGE_PREFIX')
    expect(source).toContain('${ACTIVE_BRANCH_STORAGE_PREFIX}.${user.company_id}.${user.id}')
  })
})
