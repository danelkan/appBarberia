// ─── Database Types ───────────────────────────────────────────────
export type AppointmentStatus = 'pendiente' | 'completada' | 'cancelada'
export type PaymentMethod = 'efectivo' | 'mercado_pago' | 'debito' | 'transferencia'
export type AppRole = 'superadmin' | 'admin' | 'barber'

export type CashRegisterStatus = 'open' | 'closed'
export type CashMovementType = 'income_service' | 'income_product' | 'income_extra' | 'expense' | 'adjustment'
export type CashMovementPaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

// All granular permissions that can be assigned per user
export type Permission =
  | 'view_caja'
  | 'edit_caja'
  | 'cash.view'
  | 'cash.open'
  | 'cash.close'
  | 'cash.add_movement'
  | 'cash.export'
  | 'cash.reopen'
  | 'cash.edit_closed'
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
  view_caja: 'Ver caja (legacy)',
  edit_caja: 'Registrar cobros (legacy)',
  'cash.view': 'Ver caja diaria',
  'cash.open': 'Abrir caja',
  'cash.close': 'Cerrar caja',
  'cash.add_movement': 'Agregar movimientos',
  'cash.export': 'Exportar comprobantes',
  'cash.reopen': 'Reabrir caja',
  'cash.edit_closed': 'Editar caja cerrada',
  manage_barbers: 'Gestionar barberos',
  manage_services: 'Gestionar servicios',
  manage_branches: 'Gestionar sucursales',
  manage_companies: 'Gestionar empresas',
  manage_users: 'Gestionar usuarios',
  manage_schedules: 'Gestionar horarios',
  view_clients: 'Ver clientes',
  cancel_appointments: 'Cancelar turnos',
  edit_appointments: 'Editar turnos',
  create_appointments: 'Crear turnos',
}

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Caja Diaria',
    permissions: ['cash.view', 'cash.open', 'cash.close', 'cash.add_movement', 'cash.export', 'cash.reopen', 'cash.edit_closed'],
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
    'cash.view',
    'cash.open',
    'cash.close',
    'cash.add_movement',
    'cash.export',
    'manage_barbers',
    'manage_services',
    'manage_branches',
    'manage_schedules',
    'manage_users',
    'view_clients',
    'cancel_appointments',
    'edit_appointments',
    'create_appointments',
  ],
  barber: ['cash.view', 'cash.add_movement', 'view_clients', 'cancel_appointments'],
}

export interface Company {
  id: string
  name: string
  slug?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  billing_email?: string | null
  active: boolean
  created_at: string
  branches?: Branch[]
  plan_tier?: string | null
  max_branches?: number | null
  max_barbers?: number | null
  branch_count?: number
  barber_count?: number
  user_count?: number
}

export interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  active: boolean
  created_at: string
  company_id?: string | null
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
  branches?: Branch[]
}

export interface WeeklyAvailability {
  [day: string]: DaySchedule
}

export interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

export interface Service {
  id: string
  name: string
  price: number
  base_price?: number
  effective_price?: number
  branch_prices?: { branch_id: string; price: number }[]
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
  birthday?: string | null
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
  service_price?: number | null
  date: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  created_at: string
  client?: Client
  barber?: Barber
  service?: Service
  branch?: Branch
  payment?: Payment
}

export interface CashMovement {
  id: string
  cash_register_id: string
  company_id?: string | null
  branch_id: string
  type: CashMovementType
  payment_method: CashMovementPaymentMethod
  amount: number
  description: string
  reference_type?: string | null
  reference_id?: string | null
  created_by_user_id?: string | null
  created_at: string
  updated_at?: string
  created_by_user?: Pick<UserWithRole, 'id' | 'name' | 'email'> | null
}

export interface CashAuditLog {
  id: string
  company_id?: string | null
  branch_id: string
  cash_register_id: string
  action: string
  entity_type: string
  entity_id?: string | null
  performed_by_user_id?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  performed_by_user?: Pick<UserWithRole, 'id' | 'name' | 'email'> | null
}

export interface CashRegisterSummary {
  opening_amount: number
  cash_income_total: number
  cash_expense_total: number
  cash_adjustment_total: number
  other_payment_total: number
  expected_cash_amount: number
}

export interface CashRegister {
  id: string
  company_id?: string | null
  branch_id: string
  status: CashRegisterStatus
  opening_amount: number
  expected_cash_amount?: number | null
  counted_cash_amount?: number | null
  difference_amount?: number | null
  opened_by_user_id?: string | null
  opened_at: string
  closed_by_user_id?: string | null
  closed_at?: string | null
  opening_notes?: string | null
  closing_notes?: string | null
  created_at: string
  updated_at: string
  branch?: Branch | null
  company?: Company | null
  opened_by_user?: Pick<UserWithRole, 'id' | 'name' | 'email'> | null
  closed_by_user?: Pick<UserWithRole, 'id' | 'name' | 'email'> | null
  movements?: CashMovement[]
  audit_logs?: CashAuditLog[]
  summary?: CashRegisterSummary
}

export interface UserWithRole {
  id: string
  email: string
  name?: string | null
  role: AppRole
  barber_id?: string | null
  is_barber?: boolean
  appears_in_agenda?: boolean
  agenda_branch_ids?: string[]
  company_id?: string | null
  branch_ids: string[]
  permissions: Permission[]
  active: boolean
  created_at?: string
  company?: Pick<Company, 'id' | 'name'> | null
  branches?: Pick<Branch, 'id' | 'name'>[]
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

export interface ApiResponse<T> {
  data?: T
  error?: string
}

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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  mercado_pago: 'Mercado Pago',
  debito: 'Débito',
  transferencia: 'Transferencia bancaria',
}

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  efectivo: '💵',
  mercado_pago: '💳',
  debito: '🏦',
  transferencia: '🔄',
}

export const CASH_MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  income_service: 'Ingreso por servicio',
  income_product: 'Ingreso por producto',
  income_extra: 'Ingreso extra',
  expense: 'Egreso',
  adjustment: 'Ajuste',
}

export const CASH_MOVEMENT_PAYMENT_LABELS: Record<CashMovementPaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
}

// ─── Master Admin / Multi-tenant Plan Architecture ────────────────
export type PlanTier = 'starter' | 'pro' | 'enterprise'

export interface PlanLimits {
  max_branches: number
  max_barbers: number
  custom_domain: boolean
  analytics_enabled: boolean
  priority_support: boolean
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter:    { max_branches: 1,  max_barbers: 3,  custom_domain: false, analytics_enabled: false, priority_support: false },
  pro:        { max_branches: 3,  max_barbers: 10, custom_domain: true,  analytics_enabled: true,  priority_support: false },
  enterprise: { max_branches: 99, max_barbers: 99, custom_domain: true,  analytics_enabled: true,  priority_support: true  },
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  starter:    'Starter (1 sucursal)',
  pro:        'Pro (hasta 3 sucursales)',
  enterprise: 'Enterprise (ilimitado)',
}
