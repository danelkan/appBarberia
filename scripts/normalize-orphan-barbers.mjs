import fs from 'fs'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, '')]
      })
  )
}

const env = loadEnvFile('.env.local')

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

function randomPassword() {
  return crypto.randomBytes(24).toString('base64url')
}

const { data: barbers, error: barbersError } = await supabase
  .from('barbers')
  .select('id, name, email')
  .order('created_at')

if (barbersError) throw barbersError

const [
  { data: roleRows, error: rolesError },
  { data: branchLinks, error: branchLinksError },
  { data: branches, error: branchesError },
  { data: authUsersData, error: authUsersError },
] = await Promise.all([
  supabase.from('user_roles').select('user_id, barber_id').not('barber_id', 'is', null),
  supabase.from('barber_branches').select('barber_id, branch_id'),
  supabase.from('branches').select('id, company_id'),
  supabase.auth.admin.listUsers({ perPage: 1000 }),
])

if (rolesError) throw rolesError
if (branchLinksError) throw branchLinksError
if (branchesError) throw branchesError
if (authUsersError) throw authUsersError

const linkedBarberIds = new Set((roleRows ?? []).map(row => row.barber_id))
const authUsersByEmail = new Map(
  (authUsersData?.users ?? [])
    .filter(user => user.email)
    .map(user => [user.email.toLowerCase(), user])
)
const companyIdByBranchId = new Map((branches ?? []).map(branch => [branch.id, branch.company_id]))

for (const barber of barbers ?? []) {
  if (!barber.email || linkedBarberIds.has(barber.id)) continue

  const branchIds = (branchLinks ?? [])
    .filter(link => link.barber_id === barber.id && link.branch_id)
    .map(link => link.branch_id)

  if (branchIds.length === 0) continue

  const email = barber.email.toLowerCase()
  let userId = authUsersByEmail.get(email)?.id ?? null

  if (!userId) {
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: barber.name,
        name: barber.name,
      },
    })

    if (createUserError || !createdUser.user) {
      throw createUserError ?? new Error(`No se pudo crear usuario para ${email}`)
    }

    userId = createdUser.user.id
    authUsersByEmail.set(email, createdUser.user)
  }

  const companyId = companyIdByBranchId.get(branchIds[0]) ?? null

  const { error: upsertError } = await supabase.from('user_roles').upsert({
    user_id: userId,
    role: 'barber',
    active: true,
    barber_id: barber.id,
    branch_ids: branchIds,
    company_id: companyId,
  }, { onConflict: 'user_id' })

  if (upsertError) throw upsertError

  console.log(`Normalized orphan barber ${barber.name} <${email}>`)
}
