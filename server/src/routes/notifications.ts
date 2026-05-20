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

    const eventIds = [...new Set(
      notifs.filter(n => (n.type === 'NEW_EVENT' || n.type === 'EVENT_REMINDER') && n.relatedId).map(n => n.relatedId!)
    )]
    const events = eventIds.length
      ? await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } })
      : []
    const eventMap = new Map(events.map(e => [e.id, e.title]))

    const result = notifs.map(n => ({
      id: n.id,
      type: n.type,
      relatedId: n.relatedId,
      createdAt: n.createdAt,
      title: n.type === 'NEW_EVENT'
        ? `Новий захід: ${eventMap.get(n.relatedId ?? '') ?? ''}`
        : n.type === 'EVENT_REMINDER'
          ? `⏰ Нагадування: ${eventMap.get(n.relatedId ?? '') ?? ''}`
          : 'Сповіщення',
      link: '/dashboard',
    }))

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
