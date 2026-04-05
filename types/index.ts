// ─── Database Types ───────────────────────────────────────────────
export type AppointmentStatus = 'pendiente' | 'completada' | 'cancelada'
export type PaymentMethod = 'efectivo' | 'mercado_pago' | 'debito' | 'transferencia'

export interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  active: boolean
  created_at: string
}

export interface Barber {
  id: string
  name: string
  email: string
  photo_url?: string | null
  availability: WeeklyAvailability
  created_at: string
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
