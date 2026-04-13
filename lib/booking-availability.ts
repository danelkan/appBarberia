import type { Appointment, TimeSlot, WeeklyAvailability } from '@/types'

export const BOOKING_TIMEZONE = process.env.APP_TIMEZONE ?? process.env.NEXT_PUBLIC_APP_TIMEZONE ?? 'America/Montevideo'
export const LAST_MINUTE_BOOKING_WINDOW_MINUTES = 5
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30

const ISO_DAY_MAP: Record<number, keyof WeeklyAvailability> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

const bookingClockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOOKING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export type SlotAvailabilityReason =
  | 'available'
  | 'day_unavailable'
  | 'outside_schedule'
  | 'past_cutoff'
  | 'occupied'

export interface BookingClock {
  date: string
  time: string
  minuteKey: number
}

export interface SlotAvailabilityResult {
  available: boolean
  reason: SlotAvailabilityReason
  cutoffDate: string
  cutoffTime: string
  nowDate: string
  nowTime: string
}

interface DateParts {
  year: number
  month: number
  day: number
}

function parseDateParts(date: string): DateParts {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function minuteKeyToDateTime(minuteKey: number) {
  const date = new Date(minuteKey)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()

  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  }
}

function toMinuteKey(date: string, time: string): number {
  const { year, month, day } = parseDateParts(date)
  const totalMinutes = timeToMinutes(time)
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return Date.UTC(year, month - 1, day, hour, minute)
}

export function timeToMinutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  return (hour * 60) + minute
}

export function minutesToTime(totalMinutes: number): string {
  const minutesInDay = 24 * 60
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${pad(hour)}:${pad(minute)}`
}

export function calcEndTime(startTime: string, durationMinutes: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes)
}

export function getCurrentBookingClock(referenceDate = new Date()): BookingClock {
  const parts = bookingClockFormatter.formatToParts(referenceDate)
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const date = `${lookup.year}-${lookup.month}-${lookup.day}`
  const time = `${lookup.hour}:${lookup.minute}`

  return {
    date,
    time,
    minuteKey: toMinuteKey(date, time),
  }
}

export function getBookingDayKey(date: string): keyof WeeklyAvailability {
  const { year, month, day } = parseDateParts(date)
  return ISO_DAY_MAP[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

export function addDaysToDate(date: string, days: number): string {
  const { year, month, day } = parseDateParts(date)
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + days)
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`
}

export function getSlotCutoff(date: string, startTime: string) {
  return minuteKeyToDateTime(
    toMinuteKey(date, startTime) - (LAST_MINUTE_BOOKING_WINDOW_MINUTES * 60 * 1000)
  )
}

export function isSlotAvailable(options: {
  date: string
  startTime: string
  durationMinutes: number
  availability: WeeklyAvailability
  existingAppointments: Array<Pick<Appointment, 'start_time' | 'end_time' | 'status'>>
  referenceDate?: Date
}): SlotAvailabilityResult {
  const {
    date,
    startTime,
    durationMinutes,
    availability,
    existingAppointments,
    referenceDate = new Date(),
  } = options

  const daySchedule = availability[getBookingDayKey(date)]
  const now = getCurrentBookingClock(referenceDate)
  const cutoff = getSlotCutoff(date, startTime)

  if (!daySchedule?.enabled) {
    return { available: false, reason: 'day_unavailable', cutoffDate: cutoff.date, cutoffTime: cutoff.time, nowDate: now.date, nowTime: now.time }
  }

  const slotStartMinutes = timeToMinutes(startTime)
  const slotEndMinutes = slotStartMinutes + durationMinutes
  const scheduleStartMinutes = timeToMinutes(daySchedule.start)
  const scheduleEndMinutes = timeToMinutes(daySchedule.end)

  if (slotStartMinutes < scheduleStartMinutes || slotEndMinutes > scheduleEndMinutes) {
    return { available: false, reason: 'outside_schedule', cutoffDate: cutoff.date, cutoffTime: cutoff.time, nowDate: now.date, nowTime: now.time }
  }

  const slotCutoffMinuteKey = toMinuteKey(cutoff.date, cutoff.time)
  if (now.minuteKey > slotCutoffMinuteKey) {
    return { available: false, reason: 'past_cutoff', cutoffDate: cutoff.date, cutoffTime: cutoff.time, nowDate: now.date, nowTime: now.time }
  }

  const hasOverlap = existingAppointments
    .filter(appointment => appointment.status !== 'cancelada')
    .some(appointment => {
      const appointmentStart = timeToMinutes(appointment.start_time)
      const appointmentEnd = timeToMinutes(appointment.end_time)
      return slotStartMinutes < appointmentEnd && slotEndMinutes > appointmentStart
    })

  if (hasOverlap) {
    return { available: false, reason: 'occupied', cutoffDate: cutoff.date, cutoffTime: cutoff.time, nowDate: now.date, nowTime: now.time }
  }

  return { available: true, reason: 'available', cutoffDate: cutoff.date, cutoffTime: cutoff.time, nowDate: now.date, nowTime: now.time }
}

export function generateTimeSlots(
  date: string,
  availability: WeeklyAvailability,
  durationMinutes: number,
  existingAppointments: Array<Pick<Appointment, 'start_time' | 'end_time' | 'status'>>,
  intervalMinutes = DEFAULT_SLOT_INTERVAL_MINUTES,
  referenceDate = new Date()
): TimeSlot[] {
  const daySchedule = availability[getBookingDayKey(date)]

  if (!daySchedule?.enabled) return []

  const slots: TimeSlot[] = []
  const startMinutes = timeToMinutes(daySchedule.start)
  const endMinutes = timeToMinutes(daySchedule.end)

  for (let currentMinutes = startMinutes; currentMinutes + durationMinutes <= endMinutes; currentMinutes += intervalMinutes) {
    const time = minutesToTime(currentMinutes)
    const availabilityResult = isSlotAvailable({
      date,
      startTime: time,
      durationMinutes,
      availability,
      existingAppointments,
      referenceDate,
    })

    slots.push({ time, available: availabilityResult.available })
  }

  return slots
}

export function getAvailableDates(
  availability: WeeklyAvailability,
  daysAhead = 30,
  referenceDate = new Date()
): string[] {
  const dates: string[] = []
  const today = getCurrentBookingClock(referenceDate).date

  for (let i = 0; i < daysAhead; i++) {
    const date = addDaysToDate(today, i)
    if (availability[getBookingDayKey(date)]?.enabled) {
      dates.push(date)
    }
  }

  return dates
}
