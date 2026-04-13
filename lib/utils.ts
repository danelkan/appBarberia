import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Appointment, WeeklyAvailability, TimeSlot } from '@/types'
import {
  calcEndTime as calculateEndTime,
  generateTimeSlots as buildTimeSlots,
  getAvailableDates as listAvailableDates,
} from '@/lib/booking-availability'

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
  return buildTimeSlots(date, availability, durationMinutes, existingAppointments, intervalMinutes)
}

// ─── Calculate end time ───────────────────────────────────────────
export function calcEndTime(startTime: string, durationMinutes: number): string {
  return calculateEndTime(startTime, durationMinutes)
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
  return listAvailableDates(availability, daysAhead)
}
