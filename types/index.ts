// ─── Database Types ───────────────────────────────────────────────
export type AppointmentStatus = 'pendiente' | 'completada' | 'cancelada'
export type PaymentMethod = 'efectivo' | 'mercado_pago' | 'debito' | 'transferencia'
export type AppRole = 'superadmin' | 'admin' | 'barber'

// All granular permissions that can be assigned per user
export type Permission =
  | 'view_caja'
  | 'edit_caja'
  | 'manage_barbers'
  | 'manage_services'
  | 'manage_branches'
  | 'manage_companies'
  | 'manage_users'
  | 'manage_schedules'
  | 'view_clients'
  | 'cancel_appointments'
  | 'edit_appointments'
  | 'create_appointments'

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_caja:           'Ver caja',
  edit_caja:           'Registrar cobros',
  manage_barbers:      'Gestionar barberos',
  manage_services:     'Gestionar servicios',
  manage_branches:     'Gestionar sucursales',
  manage_companies:    'Gestionar empresas',
  manage_users:        'Gestionar usuarios',
  manage_schedules:    'Gestionar horarios',
  view_clients:        'Ver clientes',
  cancel_appointments: 'Cancelar turnos',
  edit_appointments:   'Editar turnos',
  create_appointments: 'Crear turnos',
}

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Caja',
    permissions: ['view_caja', 'edit_caja'],
  },
  {
    label: 'Agenda',
    permissions: ['create_appointments', 'edit_appointments', 'cancel_appointments'],
  },
  {
    label: 'Administración',
    permissions: ['view_clients', 'manage_barbers', 'manage_services', 'manage_schedules', 'manage_branches'],
  },
  {
    label: 'Sistema',
    permissions: ['manage_users', 'manage_companies'],
  },
]

// Permissions automatically granted per role
export const ROLE_DEFAULT_PERMISSIONS: Record<AppRole, Permission[]> = {
  superadmin: Object.keys(PERMISSION_LABELS) as Permission[],
  admin: [
    'view_caja', 'edit_caja', 'manage_barbers', 'manage_services',
    'manage_branches', 'manage_schedules', 'view_clients',
    'cancel_appointments', 'edit_appointments', 'create_appointments',
  ],
  barber: ['view_caja', 'edit_caja', 'view_clients', 'cancel_appointments'],
}

export interface Company {
  id: string
  name: string
  slug?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  active: boolean
  created_at: string
  // Joined
  branches?: Branch[]
}

export interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  active: boolean
  created_at: string
  company_id?: string | null
  // Joined
  company?: Company | null
}

export interface Barber {
  id: string
  name: string
  email: string
  photo_url?: string | null
  availability: WeeklyAvailability
  created_at: string
  branch_ids?: string[]
  role?: AppRole
  // Joined
  branches?: Branch[]
}

export interface WeeklyAvailability {
  [day: string]: DaySchedule // 'monday', 'tuesday', etc.
}

export interface DaySchedule {
  enabled: boolean
  start: string // '09:00'
  end: string   // '19:00'
}

export interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
  active: boolean
  created_at: string
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
}

export interface Payment {
  id: string
  appointment_id: string
  amount: number
  method: PaymentMethod
  receipt_number: string
  notes?: string | null
  created_by?: string | null
  created_at: string
}

export interface Appointment {
  id: string
  client_id: string
  barber_id: string
  service_id: string
  branch_id?: string | null
  date: string       // 'YYYY-MM-DD'
  start_time: string // 'HH:mm'
  end_time: string   // 'HH:mm'
  status: AppointmentStatus
  created_at: string
  // Joined
  client?: Client
  barber?: Barber
  service?: Service
  branch?: Branch
  payment?: Payment
}

// User as returned by /api/users
export interface UserWithRole {
  id: string
  email: string
  name?: string | null
  role: AppRole
  barber_id?: string | null
  company_id?: string | null
  branch_ids: string[]
  permissions: Permission[]
  active: boolean
  created_at?: string
  company?: Pick<Company, 'id' | 'name'> | null
  branches?: Pick<Branch, 'id' | 'name'>[]
  // Joined barber info
  barber?: Pick<Barber, 'id' | 'name' | 'email'> | null
}

// ─── Booking Flow Types ───────────────────────────────────────────
export interface BookingStep {
  step: 1 | 2 | 3 | 4 | 5
  branch?: Branch
  service?: Service
  barber?: Barber
  date?: string
  time?: string
  client?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
}

export interface TimeSlot {
  time: string
  available: boolean
}

// ─── API Response Types ───────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
}

// ─── Payment summary types ────────────────────────────────────────
export interface PaymentTotals {
  efectivo: number
  mercado_pago: number
  debito: number
  transferencia: number
  total: number
}

export interface PaymentSummary {
  today: PaymentTotals
  week: PaymentTotals
  month: PaymentTotals
  year: PaymentTotals
}

// ─── Payment method labels ────────────────────────────────────────
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo:       'Efectivo',
  mercado_pago:   'Mercado Pago',
  debito:         'Débito',
  transferencia:  'Transferencia bancaria',
}

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  efectivo:       '💵',
  mercado_pago:   '💳',
  debito:         '🏦',
  transferencia:  '🔄',
}
