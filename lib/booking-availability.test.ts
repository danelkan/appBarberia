import { describe, expect, it } from 'vitest'
import type { Appointment, WeeklyAvailability } from '@/types'
import {
  generateTimeSlots,
  getAvailableDates,
  getSlotCutoff,
  isSlotAvailable,
} from '@/lib/booking-availability'

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '18:00' },
  sunday: { enabled: false, start: '09:00', end: '18:00' },
}

describe('booking availability', () => {
  it('documents the cutoff as inclusive at the exact 5-minute mark', () => {
    expect(getSlotCutoff('2026-04-13', '15:00')).toEqual({
      date: '2026-04-13',
      time: '14:55',
    })
  })

  it('keeps a free slot available when more than 5 minutes remain', () => {
    const result = isSlotAvailable({
      date: '2026-04-13',
      startTime: '15:00',
      durationMinutes: 30,
      availability: DEFAULT_AVAILABILITY,
      existingAppointments: [],
      referenceDate: new Date('2026-04-13T17:54:00.000Z'),
    })

    expect(result.available).toBe(true)
    expect(result.reason).toBe('available')
  })

  it('keeps a free slot available at exactly 5 minutes before start', () => {
    const result = isSlotAvailable({
      date: '2026-04-13',
      startTime: '15:00',
      durationMinutes: 30,
      availability: DEFAULT_AVAILABILITY,
      existingAppointments: [],
      referenceDate: new Date('2026-04-13T17:55:00.000Z'),
    })

    expect(result.available).toBe(true)
    expect(result.reason).toBe('available')
  })

  it('blocks a free slot once fewer than 5 minutes remain', () => {
    const result = isSlotAvailable({
      date: '2026-04-13',
      startTime: '15:00',
      durationMinutes: 30,
      availability: DEFAULT_AVAILABILITY,
      existingAppointments: [],
      referenceDate: new Date('2026-04-13T17:56:00.000Z'),
    })

    expect(result.available).toBe(false)
    expect(result.reason).toBe('past_cutoff')
  })

  it('never offers a slot that already passed', () => {
    const result = isSlotAvailable({
      date: '2026-04-13',
      startTime: '15:00',
      durationMinutes: 30,
      availability: DEFAULT_AVAILABILITY,
      existingAppointments: [],
      referenceDate: new Date('2026-04-13T18:01:00.000Z'),
    })

    expect(result.available).toBe(false)
    expect(result.reason).toBe('past_cutoff')
  })

  it('keeps agendas independent across barbers by only blocking overlapping appointments for the current barber', () => {
    const barberAAppointments: Array<Pick<Appointment, 'start_time' | 'end_time' | 'status'>> = [
      { start_time: '15:00', end_time: '15:30', status: 'pendiente' },
    ]

    const barberA = generateTimeSlots(
      '2026-04-13',
      DEFAULT_AVAILABILITY,
      30,
      barberAAppointments,
      30,
      new Date('2026-04-13T17:00:00.000Z')
    )

    const barberB = generateTimeSlots(
      '2026-04-13',
      DEFAULT_AVAILABILITY,
      30,
      [],
      30,
      new Date('2026-04-13T17:00:00.000Z')
    )

    expect(barberA.find(slot => slot.time === '15:00')?.available).toBe(false)
    expect(barberB.find(slot => slot.time === '15:00')?.available).toBe(true)
  })

  it('uses the business timezone when deciding what counts as today', () => {
    const dates = getAvailableDates(
      {
        monday: { enabled: true, start: '09:00', end: '18:00' },
      },
      2,
      new Date('2026-04-14T01:30:00.000Z')
    )

    expect(dates).toEqual(['2026-04-13'])
  })
})
