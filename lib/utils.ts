import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parse, addMinutes, isAfter, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Appointment, WeeklyAvailability, TimeSlot } from '@/types'

// ─── Class merging ────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date formatting ──────────────────────────────────────────────
export const DAY_NAMES: Record<string, string> = {
  monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles',
  thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo',
}

export const ISO_DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string'
    ? new Date(date.includes('T') ? date : date + 'T00:00:00')
    : date
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency', currency: 'UYU', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(price)
}

// ─── Time slot generation ─────────────────────────────────────────
export function generateTimeSlots(
  date: string,
  availability: WeeklyAvailability,
  durationMinutes: number,
  existingAppointments: Appointment[],
  intervalMinutes = 30
): TimeSlot[] {
  const d = new Date(date + 'T00:00:00')
  const dayKey = ISO_DAY_MAP[d.getDay()]
  const daySchedule = availability[dayKey]

  if (!daySchedule?.enabled) return []

  const slots: TimeSlot[] = []
  const startTime = parse(daySchedule.start, 'HH:mm', d)
  const endTime = parse(daySchedule.end, 'HH:mm', d)
  const now = new Date()
  const isToday = format(d, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')

  let current = startTime
  while (isBefore(current, endTime)) {
    const slotEnd = addMinutes(current, durationMinutes)
    if (isAfter(slotEnd, endTime)) break

    const timeStr = format(current, 'HH:mm')
    const slotDateTime = parse(timeStr, 'HH:mm', d)

    // Skip past times for today — allow booking up to 5 min before slot
    const isPast = isToday && isBefore(slotDateTime, addMinutes(now, 5))

    // Check overlap with existing appointments
    const hasOverlap = existingAppointments
      .filter(a => a.status !== 'cancelada')
      .some(a => {
        const apptStart = parse(a.start_time.slice(0, 5), 'HH:mm', d)
        const apptEnd = parse(a.end_time.slice(0, 5), 'HH:mm', d)
        return isBefore(current, apptEnd) && isAfter(slotEnd, apptStart)
      })

    slots.push({ time: timeStr, available: !isPast && !hasOverlap })
    current = addMinutes(current, intervalMinutes)
  }

  return slots
}

// ─── Calculate end time ───────────────────────────────────────────
export function calcEndTime(startTime: string, durationMinutes: number): string {
  const base = parse(startTime, 'HH:mm', new Date())
  return format(addMinutes(base, durationMinutes), 'HH:mm')
}

// ─── Status labels & colors ───────────────────────────────────────
export const STATUS_CONFIG = {
  pendiente:  { label: 'Pendiente',  color: 'text-amber-700 bg-amber-50 border-amber-200' },
  completada: { label: 'Completada', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  cancelada:  { label: 'Cancelada',  color: 'text-red-600 bg-red-50 border-red-200' },
}

// ─── Get next N available dates for a barber ─────────────────────
export function getAvailableDates(
  availability: WeeklyAvailability,
  daysAhead = 30
): string[] {
  const dates: string[] = []
  const today = startOfDay(new Date())

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dayKey = ISO_DAY_MAP[d.getDay()]
    if (availability[dayKey]?.enabled) {
      dates.push(format(d, 'yyyy-MM-dd'))
    }
  }

  return dates
}
