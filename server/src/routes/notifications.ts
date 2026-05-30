import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()
router.use(authMiddleware)

// GET /api/notifications — list unread notifications with resolved titles
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: req.userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const eventNotifTypes = new Set(['NEW_EVENT', 'EVENT_REMINDER', 'EVENT_RECORDING_AVAILABLE', 'EVENT_NEW_REGISTRATION', 'EVENT_REGISTRATION_CONFIRMED'])
    const eventIds = [...new Set(
      notifs.filter(n => eventNotifTypes.has(n.type) && n.relatedId).map(n => n.relatedId!)
    )]
    const events = eventIds.length
      ? await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } })
      : []
    const eventMap = new Map(events.map(e => [e.id, e.title]))

    const groupNotifTypes = new Set([
      'GROUP_SUPERVISION_NEW', 'GROUP_SUPERVISION_REGISTRATION_OPEN',
      'GROUP_SUPERVISION_CASE_SUBMITTED', 'GROUP_SUPERVISION_PARTICIPANT_JOINED',
      'GROUP_SUPERVISION_RECEIPT_UPLOADED', 'GROUP_SUPERVISION_PAYMENT_CONFIRMED',
      'GROUP_SUPERVISION_PAYMENT_REJECTED', 'GROUP_SUPERVISION_RECORDING',
      'GROUP_SUPERVISION_COMPLETED', 'GROUP_SUPERVISION_REMINDER',
    ])
    const groupIds = [...new Set(
      notifs.filter(n => groupNotifTypes.has(n.type) && n.relatedId).map(n => n.relatedId!)
    )]
    const groupSupervisions = groupIds.length
      ? await prisma.groupSupervision.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, supervisor: { select: { firstName: true, lastName: true } } },
        })
      : []
    const groupMap = new Map(groupSupervisions.map(g => [g.id, `${g.supervisor.firstName} ${g.supervisor.lastName}`]))

    const TITLES: Record<string, string> = {
      SUPERVISION_APPROVED: '✅ Супервізію підтверджено',
      SUPERVISION_REJECTED: 'Супервізію відхилено',
      SUPERVISION_REQUEST: 'Нова заявка на супервізію',
      SEMINAR_APPROVED: '✅ Семінар підтверджено',
      SEMINAR_REJECTED: 'Семінар відхилено',
      SLOT_BOOKING_REQUEST: '📋 Нова заявка на бронювання',
      SLOT_BOOKING_APPROVED: '✅ Бронювання підтверджено',
      SLOT_BOOKING_REJECTED: 'Бронювання відхилено',
      SLOT_REMINDER: '⏰ Нагадування: супервізія завтра',
      SUPERVISION_AUTO_ADDED: '✅ Супервізію автоматично додано до журналу',
      GROUP_SUPERVISION_NEW: '🌿 Нова групова супервізія',
      GROUP_SUPERVISION_REGISTRATION_OPEN: '✅ Реєстрація на групову супервізію відкрита',
      GROUP_SUPERVISION_CASE_SUBMITTED: '📋 Подано випадок для групової супервізії',
      GROUP_SUPERVISION_PARTICIPANT_JOINED: '👤 Новий учасник групової супервізії',
      GROUP_SUPERVISION_RECEIPT_UPLOADED: '💳 Квитанцію завантажено',
      GROUP_SUPERVISION_PAYMENT_CONFIRMED: '✅ Оплату підтверджено — Zoom доступний',
      GROUP_SUPERVISION_PAYMENT_REJECTED: 'Оплату не підтверджено — завантажте нову квитанцію',
      GROUP_SUPERVISION_RECORDING: '🎬 Запис групової супервізії доступний',
      GROUP_SUPERVISION_COMPLETED: '✅ Групову супервізію завершено — запис у журналі',
      GROUP_SUPERVISION_REMINDER: '⏰ Нагадування: групова супервізія скоро',
    }

    const LINKS: Record<string, string> = {
      SUPERVISION_APPROVED: '/supervisions',
      SUPERVISION_REJECTED: '/supervisions',
      SUPERVISION_REQUEST: '/supervisor',
      SEMINAR_APPROVED: '/seminars',
      SEMINAR_REJECTED: '/seminars',
      NEW_EVENT: '/events',
      EVENT_REMINDER: '/events',
      EVENT_RECORDING_AVAILABLE: '/events',
      EVENT_NEW_REGISTRATION: '/supervisor',
      EVENT_REGISTRATION_CONFIRMED: '/events',
      SLOT_BOOKING_REQUEST: '/supervisor',
      SLOT_BOOKING_APPROVED: '/my-bookings',
      SLOT_BOOKING_REJECTED: '/slots',
      SLOT_REMINDER: '/my-bookings',
      SUPERVISION_AUTO_ADDED: '/supervisions',
      GROUP_SUPERVISION_NEW: '/dashboard',
      GROUP_SUPERVISION_REGISTRATION_OPEN: '/dashboard',
      GROUP_SUPERVISION_CASE_SUBMITTED: '/supervisor',
      GROUP_SUPERVISION_PARTICIPANT_JOINED: '/supervisor',
      GROUP_SUPERVISION_RECEIPT_UPLOADED: '/supervisor',
      GROUP_SUPERVISION_PAYMENT_CONFIRMED: '/dashboard',
      GROUP_SUPERVISION_PAYMENT_REJECTED: '/dashboard',
      GROUP_SUPERVISION_RECORDING: '/dashboard',
      GROUP_SUPERVISION_COMPLETED: '/supervisions',
      GROUP_SUPERVISION_REMINDER: '/dashboard',
    }

    const result = notifs.map(n => {
      let title: string
      if (n.type === 'NEW_EVENT') {
        title = `Новий захід: ${eventMap.get(n.relatedId ?? '') ?? ''}`
      } else if (n.type === 'EVENT_REMINDER') {
        title = `⏰ Нагадування: ${eventMap.get(n.relatedId ?? '') ?? ''}`
      } else if (n.type === 'EVENT_RECORDING_AVAILABLE') {
        title = `🎬 Запис заходу доступний: ${eventMap.get(n.relatedId ?? '') ?? ''}`
      } else if (n.type === 'EVENT_NEW_REGISTRATION') {
        title = `👤 Нова реєстрація: ${eventMap.get(n.relatedId ?? '') ?? ''}`
      } else if (n.type === 'EVENT_REGISTRATION_CONFIRMED') {
        title = `✅ Реєстрацію підтверджено: ${eventMap.get(n.relatedId ?? '') ?? ''}`
      } else if (groupNotifTypes.has(n.type)) {
        const baseTitle = TITLES[n.type] ?? 'Сповіщення'
        const supervisorName = n.relatedId ? groupMap.get(n.relatedId) : undefined
        title = supervisorName ? `${baseTitle} · ${supervisorName}` : baseTitle
      } else {
        title = TITLES[n.type] ?? 'Сповіщення'
      }
      return { id: n.id, type: n.type, relatedId: n.relatedId, createdAt: n.createdAt, title, link: LINKS[n.type] ?? '/dashboard' }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/notifications/:id/read — mark single notification as read
router.post('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id as string, userId: req.userId },
      data: { isRead: true },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/unread-count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, isRead: false },
    })
    res.json({ count })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.post('/mark-read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
