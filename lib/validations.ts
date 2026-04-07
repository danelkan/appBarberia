import { z } from 'zod'

// ─── Common Schemas ────────────────────────────────────────────────
export const uuidSchema = z.string().uuid('Invalid ID format')

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format')

// ─── Appointment Schemas ───────────────────────────────────────────
export const createAppointmentSchema = z.object({
  serviceId: uuidSchema,
  barberId:  uuidSchema,
  branchId:  uuidSchema.optional().nullable(),
  date:      dateSchema,
  startTime: timeSchema,
  client: z.object({
    first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
    last_name: z.string().max(100, 'Last name too long').optional().default(''),
    email: z.string().email('Invalid email format').max(255),
    phone: z.string().min(1, 'Phone is required').max(50, 'Phone too long'),
  }),
})

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['pendiente', 'completada', 'cancelada'], {
    errorMap: () => ({ message: 'Status must be pendiente, completada, or cancelada' })
  }),
})

export const appointmentQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

// ─── Barber Schemas ────────────────────────────────────────────────
export const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: timeSchema,
  end: timeSchema,
})

export const weeklyAvailabilitySchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
}).partial()

export const createBarberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
  // If provided, link to an existing auth user instead of creating a new one
  existing_user_email: z.string().email('Invalid email format').max(255).optional(),
  role: z.enum(['admin', 'barber']).optional().default('barber'),
  branch_ids: z.array(uuidSchema).min(1, 'Select at least one branch'),
  photo_url: z.string().url('Invalid URL').optional().nullable(),
  availability: weeklyAvailabilitySchema.optional(),
}).superRefine((data, ctx) => {
  if (!data.existing_user_email && !data.password) {
    ctx.addIssue({
      code: 'custom',
      path: ['password'],
      message: 'Password is required when not linking an existing user',
    })
  }
})

export const updateBarberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(6).max(128).optional(),
  role: z.enum(['admin', 'barber']).optional(),
  branch_ids: z.array(uuidSchema).min(1).optional(),
  photo_url: z.string().url().optional().nullable(),
  availability: weeklyAvailabilitySchema.optional(),
})

// ─── Service Schemas ───────────────────────────────────────────────
export const createServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  price: z.number().positive('Price must be positive').max(99999.99, 'Price too high'),
  duration_minutes: z.number().int().positive('Duration must be positive').max(480, 'Duration cannot exceed 8 hours'),
  active: z.boolean().optional().default(true),
})

export const updateServiceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price: z.number().positive().max(99999.99).optional(),
  duration_minutes: z.number().int().positive().max(480).optional(),
  active: z.boolean().optional(),
})

// ─── Slots Query Schema ────────────────────────────────────────────
export const slotsQuerySchema = z.object({
  barberId: uuidSchema,
  date: dateSchema,
  duration: z.coerce.number().int().positive().max(480).optional().default(30),
})

// ─── Client Schemas ────────────────────────────────────────────────
export const clientQuerySchema = z.object({
  q: z.string().max(100).optional(),
})

// ─── Cash Schemas ─────────────────────────────────────────────────
export const openCashRegisterSchema = z.object({
  branch_id: uuidSchema,
  company_id: uuidSchema.optional().nullable(),
  opening_amount: z.coerce.number().min(0, 'Opening amount must be 0 or greater'),
  opening_notes: z.string().max(500).optional().nullable(),
})

export const cashMovementSchema = z.object({
  type: z.enum(['income_service', 'income_product', 'income_extra', 'expense', 'adjustment']),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required').max(500),
  reference_type: z.string().max(100).optional().nullable(),
  reference_id: z.string().max(100).optional().nullable(),
})

export const closeCashRegisterSchema = z.object({
  counted_cash_amount: z.coerce.number().min(0, 'Counted cash must be 0 or greater'),
  closing_notes: z.string().max(500).optional().nullable(),
})

export const cashRegisterQuerySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  branch_id: uuidSchema.optional(),
  company_id: uuidSchema.optional(),
  opened_by_user_id: uuidSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

// ─── Type exports ──────────────────────────────────────────────────
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>
export type CreateBarberInput = z.infer<typeof createBarberSchema>
export type UpdateBarberInput = z.infer<typeof updateBarberSchema>
export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>
export type CashMovementInput = z.infer<typeof cashMovementSchema>
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>
