import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import prisma from './prisma'
import { sendEventReminder } from './email'

export function startReminderScheduler() {
  setInterval(async () => {
    try {
      const now = new Date()
      const due = await prisma.eventReminder.findMany({
        where: { sent: false, sendAt: { lte: now } },
        include: { event: true },
      })

      for (const reminder of due) {
        // Mark sent first to prevent double-send on crash/restart
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
    } catch (e) {
      console.error('[reminderScheduler] error:', e)
    }
  }, 60_000) // every minute
}
