import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import prisma from './prisma'
import { sendEventReminder, sendSlotReminder, sendStaleBookingReminder } from './email'

export function startReminderScheduler() {
  setInterval(async () => {
    try {
      await checkEventReminders()
      await checkSlotReminders()
      await checkStaleBookings()
      await checkCompletedBookings()
    } catch (e) {
      console.error('[reminderScheduler] error:', e)
    }
  }, 60_000) // every minute
}

async function checkEventReminders() {
  const now = new Date()
  const due = await prisma.eventReminder.findMany({
    where: { sent: false, sendAt: { lte: now } },
    include: { event: true },
  })

  for (const reminder of due) {
    await prisma.eventReminder.update({ where: { id: reminder.id }, data: { sent: true } })

    const users = await prisma.user.findMany({ select: { id: true, email: true, firstName: true } })
    const dateStr = format(new Date(reminder.event.date), 'd MMMM yyyy', { locale: uk })

    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, type: 'EVENT_REMINDER', relatedId: reminder.event.id, isRead: false })),
      skipDuplicates: true,
    })

    for (const user of users) {
      await sendEventReminder(user.email, user.firstName, reminder.event.title, dateStr).catch(console.error)
    }
  }
}

async function checkSlotReminders() {
  const now = new Date()
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const bookings = await prisma.supervisionBooking.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] }, reminderSent: false },
    include: {
      slot: {
        include: {
          supervisor: { select: { id: true, firstName: true, lastName: true, email: true, meetingLink: true } },
        },
      },
      therapist: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  for (const booking of bookings) {
    const slotDateTime = new Date(`${booking.slot.date}T${booking.slot.time}`)
    if (slotDateTime < windowStart || slotDateTime > windowEnd) continue

    await prisma.supervisionBooking.update({ where: { id: booking.id }, data: { reminderSent: true } })

    const supervisorName = `${booking.slot.supervisor.firstName} ${booking.slot.supervisor.lastName}`
    const therapistName = `${booking.therapist.firstName} ${booking.therapist.lastName}`

    await prisma.notification.createMany({
      data: [
        { userId: booking.therapistId, type: 'SLOT_REMINDER', relatedId: booking.id },
        { userId: booking.slot.supervisorId, type: 'SLOT_REMINDER', relatedId: booking.id },
      ],
      skipDuplicates: true,
    })

    sendSlotReminder(
      booking.therapist.email,
      booking.therapist.firstName,
      supervisorName,
      booking.slot.date,
      booking.slot.time,
      booking.slot.supervisor.meetingLink,
    ).catch(console.error)

    sendSlotReminder(
      booking.slot.supervisor.email,
      booking.slot.supervisor.firstName,
      therapistName,
      booking.slot.date,
      booking.slot.time,
      booking.slot.supervisor.meetingLink,
    ).catch(console.error)
  }
}

async function checkStaleBookings() {
  const staleThreshold = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const stale = await prisma.supervisionBooking.findMany({
    where: { status: 'PENDING', staleSent: false, createdAt: { lte: staleThreshold } },
    include: {
      slot: {
        include: { supervisor: { select: { firstName: true, lastName: true, email: true } } },
      },
      therapist: { select: { firstName: true, lastName: true } },
    },
  })

  for (const booking of stale) {
    await prisma.supervisionBooking.update({ where: { id: booking.id }, data: { staleSent: true } })

    const therapistName = `${booking.therapist.firstName} ${booking.therapist.lastName}`
    sendStaleBookingReminder(
      booking.slot.supervisor.email,
      booking.slot.supervisor.firstName,
      therapistName,
      booking.caseTitle ?? '—',
      booking.slot.date,
    ).catch(console.error)
  }
}

async function checkCompletedBookings() {
  const now = new Date()

  const bookings = await prisma.supervisionBooking.findMany({
    where: { status: 'PENDING' },
    include: { slot: true },
  })

  for (const booking of bookings) {
    const slotStart = new Date(`${booking.slot.date}T${booking.slot.time}`)
    const slotEnd = new Date(slotStart.getTime() + booking.slot.duration * 60 * 1000)
    if (slotEnd > now) continue // session not yet finished

    try {
      await prisma.$transaction([
        prisma.supervisionBooking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } }),
        prisma.supervisionSlot.update({ where: { id: booking.slotId }, data: { status: 'COMPLETED' } }),
        prisma.supervision.create({
          data: {
            userId: booking.therapistId,
            supervisorId: booking.slot.supervisorId,
            date: slotStart,
            type: booking.slot.type === 'INDIVIDUAL' ? 'INDIVIDUAL_PRESENTER' : 'GROUP_PRESENTER',
            status: 'APPROVED',
            hours: booking.slot.duration / 60,
          },
        }),
      ])

      await prisma.notification.create({
        data: { userId: booking.therapistId, type: 'SUPERVISION_AUTO_ADDED', relatedId: booking.id },
      })
    } catch (e) {
      console.error('[checkCompletedBookings] failed for booking', booking.id, e)
    }
  }
}
