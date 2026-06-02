import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import prisma from './prisma'
import { sendEventReminder, sendSlotReminder, sendStaleBookingReminder } from './email'
import { sendPushToUser } from './push'

export function startReminderScheduler() {
  setInterval(async () => {
    try {
      await checkEventReminders()
      await checkSlotReminders()
      await checkStaleBookings()
      await checkCompletedBookings()
      await checkGroupSupervisionReminders()
      await checkGroupSupervisionAutoComplete()
      await checkTherapistRequestAutoClose()
    } catch (e) {
      console.error('[reminderScheduler] error:', e)
    }
  }, 60_000) // every minute
}

async function checkEventReminders() {
  const now = new Date()
  const due = await prisma.eventReminder.findMany({
    where: { sent: false, sendAt: { lte: now } },
    include: {
      event: {
        include: { organizer: { select: { firstName: true, lastName: true } } },
      },
    },
  })

  for (const reminder of due) {
    await prisma.eventReminder.update({ where: { id: reminder.id }, data: { sent: true } })

    const ev = reminder.event
    const users = await prisma.user.findMany({ select: { id: true, email: true, firstName: true } })
    const dateStr = format(new Date(ev.date), 'd MMMM yyyy', { locale: uk })
    const organizerName = ev.organizer
      ? `${ev.organizer.firstName} ${ev.organizer.lastName}`
      : undefined

    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, type: 'EVENT_REMINDER', relatedId: ev.id, isRead: false })),
      skipDuplicates: true,
    })

    for (const user of users) {
      await sendEventReminder(
        user.email,
        user.firstName,
        ev.title,
        dateStr,
        ev.id,
        ev.startTime,
        ev.endTime,
        ev.coverImageUrl,
        organizerName,
        ev.price,
        ev.currency,
      ).catch(console.error)
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

    sendPushToUser(booking.therapistId, '⏰ Нагадування: супервізія завтра', `${supervisorName} · ${booking.slot.date} ${booking.slot.time}`, '/my-bookings').catch(() => {})
    sendPushToUser(booking.slot.supervisorId, '⏰ Нагадування: супервізія завтра', `${therapistName} · ${booking.slot.date} ${booking.slot.time}`, '/supervisor').catch(() => {})
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

async function checkGroupSupervisionReminders() {
  const now = new Date()
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const in1h = new Date(now.getTime() + 60 * 60 * 1000)

  const groups = await prisma.groupSupervision.findMany({
    where: {
      status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED'] },
    },
    include: {
      participants: {
        where: { paymentStatus: { in: ['CONFIRMED', 'FREE'] } },
        select: { userId: true },
      },
    },
  })

  for (const group of groups) {
    const sessionDt = new Date(`${group.scheduledDate}T${group.scheduledTime}`)

    // 3-day reminder
    if (!group.reminderSent3d && sessionDt <= in3d && sessionDt > in1h) {
      await prisma.groupSupervision.update({ where: { id: group.id }, data: { reminderSent3d: true } })
      for (const p of group.participants) {
        await prisma.notification.create({
          data: { userId: p.userId, type: 'GROUP_SUPERVISION_REMINDER', relatedId: group.id },
        }).catch(() => {})
        sendPushToUser(p.userId, '⏰ Нагадування: групова супервізія через 3 дні', `${group.title} · ${group.scheduledDate} ${group.scheduledTime}`, `/group-supervisions/${group.id}`).catch(() => {})
      }
    }

    // 1-hour reminder
    if (!group.reminderSent1h && sessionDt <= in1h && sessionDt > now) {
      await prisma.groupSupervision.update({ where: { id: group.id }, data: { reminderSent1h: true } })
      for (const p of group.participants) {
        await prisma.notification.create({
          data: { userId: p.userId, type: 'GROUP_SUPERVISION_REMINDER', relatedId: group.id },
        }).catch(() => {})
        sendPushToUser(p.userId, '⏰ Нагадування: групова супервізія через 1 годину', `${group.title} · ${group.scheduledTime}`, `/group-supervisions/${group.id}`).catch(() => {})
      }
    }
  }
}

async function checkGroupSupervisionAutoComplete() {
  const now = new Date()

  // Auto-close REGISTRATION_OPEN → REGISTRATION_CLOSED when session starts
  const openGroups = await prisma.groupSupervision.findMany({
    where: { status: 'REGISTRATION_OPEN' },
  })
  for (const group of openGroups) {
    const sessionStart = new Date(`${group.scheduledDate}T${group.scheduledTime}`)
    if (sessionStart > now) continue
    await prisma.groupSupervision.update({
      where: { id: group.id },
      data: { status: 'REGISTRATION_CLOSED' },
    })
  }

  // Auto-transition REGISTRATION_CLOSED → WAITING_FOR_RECORDING when session ends
  const closedGroups = await prisma.groupSupervision.findMany({
    where: { status: 'REGISTRATION_CLOSED', autoCompleteSent: false },
  })
  for (const group of closedGroups) {
    const slotEnd = new Date(`${group.scheduledDate}T${group.scheduledTime}`)
    slotEnd.setMinutes(slotEnd.getMinutes() + group.duration)
    if (slotEnd > now) continue

    await prisma.groupSupervision.update({
      where: { id: group.id },
      data: { status: 'WAITING_FOR_RECORDING', autoCompleteSent: true },
    })
  }

  // Auto-complete when recording expires
  const recordingGroups = await prisma.groupSupervision.findMany({
    where: { status: 'RECORDING_AVAILABLE', recordingExpiresAt: { lte: now } },
    include: { participants: { where: { paymentStatus: { in: ['CONFIRMED', 'FREE'] } } } },
  })
  for (const group of recordingGroups) {
    const sessionDate = new Date(`${group.scheduledDate}T${group.scheduledTime}`)
    try {
      await prisma.$transaction(async tx => {
        await tx.groupSupervision.update({ where: { id: group.id }, data: { status: 'COMPLETED' } })
        for (const p of group.participants) {
          await tx.supervision.create({
            data: {
              userId: p.userId,
              supervisorId: group.supervisorId,
              date: sessionDate,
              type: p.isPresenter ? 'GROUP_PRESENTER' : 'GROUP_LISTENER',
              status: 'APPROVED',
              hours: group.duration / 60,
            },
          })
          await tx.notification.create({
            data: { userId: p.userId, type: 'GROUP_SUPERVISION_COMPLETED', relatedId: group.id },
          })
          sendPushToUser(p.userId, '✅ Групову супервізію завершено', 'Запис додано до журналу', '/supervisions').catch(() => {})
        }
      })
    } catch (e) {
      console.error('[checkGroupSupervisionAutoComplete] failed for group', group.id, e)
    }
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

      sendPushToUser(booking.therapistId, '✅ Супервізію додано до журналу', `${booking.slot.date} · запис підтверджено автоматично`, '/supervisions').catch(() => {})
    } catch (e) {
      console.error('[checkCompletedBookings] failed for booking', booking.id, e)
    }
  }
}

async function checkTherapistRequestAutoClose() {
  const threshold = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  const stale = await prisma.therapistRequest.findMany({
    where: { status: 'OPEN', createdAt: { lte: threshold } },
    select: { id: true },
  })
  for (const req of stale) {
    try {
      await prisma.therapistRequest.update({
        where: { id: req.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
    } catch (e) {
      console.error('[checkTherapistRequestAutoClose] failed for request', req.id, e)
    }
  }
}
